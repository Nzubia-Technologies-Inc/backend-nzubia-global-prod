import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, ILike, LessThanOrEqual, Repository } from 'typeorm';
import { P2pRoute } from './entities/p2p-route.entity';
import { P2pCourierProfile } from './entities/p2p-courier-profile.entity';
import { CourierVerificationState, RouteStatus } from './enums';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { UpdateRouteStatusDto } from './dto/update-route-status.dto';
import { RouteFiltersDto } from './dto/route-filters.dto';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { EmailService } from '../notifications/email/email.service';

/** Haversine distance in km between two lat/lng points */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/** Rank a single route against a request's origin/destination.
 *  Returns a composite score in [0, 1]. */
export function scoreRoute(
    route: P2pRoute,
    destCountry: string,
    destCity: string,
    originLat: number | null,
    originLng: number | null,
    weightKg: number,
    maxRadiusKm: number,
): number {
    // 1. Route destination match (binary)
    const routeMatch =
        route.destinationCountry.toLowerCase() === destCountry.toLowerCase() &&
            route.destinationCity.toLowerCase() === destCity.toLowerCase()
            ? 1.0
            : 0.0;

    // 2. Pickup proximity (Haversine, clamped to [0,1])
    let proximityScore = 0.5; // neutral when coordinates unavailable
    if (
        route.pickupLatitude != null &&
        route.pickupLongitude != null &&
        originLat != null &&
        originLng != null
    ) {
        const dist = haversineKm(
            Number(route.pickupLatitude),
            Number(route.pickupLongitude),
            originLat,
            originLng,
        );
        proximityScore = Math.max(0, Math.min(1, 1 - dist / maxRadiusKm));
    }

    // 3. Departure date freshness (0 = 30+ days away, 1 = today)
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysUntil = Math.max(
        0,
        (new Date(route.departureDate).getTime() - Date.now()) / msPerDay,
    );
    const departureDateScore = Math.max(0, 1 - daysUntil / 30);

    // 4. Capacity utilisation
    const cap = Number(route.capacityKg);
    const capacityScore = cap > 0 && cap >= weightKg ? weightKg / cap : 0;

    // 5. Verification bonus
    const verificationBonus =
        route.courierProfile?.verificationState === CourierVerificationState.ACTIVE ? 1.0 : 0.5;

    // 6. Reputation
    const reputationScore = Number(route.courierProfile?.rating ?? 0) / 5.0;

    return (
        routeMatch * 0.35 +
        proximityScore * 0.25 +
        departureDateScore * 0.2 +
        capacityScore * 0.1 +
        verificationBonus * 0.05 +
        reputationScore * 0.05
    );
}

@Injectable()
export class RouteService {
    private readonly logger = new Logger(RouteService.name);

    constructor(
        @InjectRepository(P2pRoute)
        private routeRepo: Repository<P2pRoute>,

        @InjectRepository(P2pCourierProfile)
        private courierProfileRepo: Repository<P2pCourierProfile>,

        private platformSettingsService: PlatformSettingsService,
        private emailService: EmailService,
    ) { }

    private async getCourierProfile(userId: string): Promise<P2pCourierProfile> {
        const profile = await this.courierProfileRepo.findOne({ where: { user_id: userId } });
        if (!profile) throw new NotFoundException('Courier profile not found. Apply as courier first.');
        return profile;
    }

    async createRoute(userId: string, dto: CreateRouteDto): Promise<P2pRoute> {
        const profile = await this.getCourierProfile(userId);

        if (profile.verificationState !== CourierVerificationState.ACTIVE) {
            throw new BadRequestException(
                `Only ACTIVE couriers can publish routes (current state: ${profile.verificationState}).`,
            );
        }

        const route = this.routeRepo.create({
            courier_profile_id: profile.id,
            status: RouteStatus.DRAFT,
            ...dto,
            departureDate: new Date(dto.departureDate),
            returnDate: dto.returnDate ? new Date(dto.returnDate) : null,
        });

        return this.routeRepo.save(route);
    }

    async listMyRoutes(userId: string): Promise<P2pRoute[]> {
        const profile = await this.courierProfileRepo.findOne({ where: { user_id: userId } });
        if (!profile) return [];

        return this.routeRepo.find({
            where: { courier_profile_id: profile.id },
            order: { departureDate: 'ASC' },
            relations: ['courierProfile', 'courierProfile.user'],
        });
    }

    async listRoutes(filters: RouteFiltersDto): Promise<P2pRoute[]> {
        const qb = this.routeRepo
            .createQueryBuilder('route')
            .leftJoinAndSelect('route.courierProfile', 'cp')
            .where('route.status = :status', { status: RouteStatus.PUBLISHED });

        if (filters.destinationCountry) {
            qb.andWhere('route.destinationCountry LIKE :country', {
                country: `%${filters.destinationCountry}%`,
            });
        }
        if (filters.destinationCity) {
            qb.andWhere('route.destinationCity LIKE :city', {
                city: `%${filters.destinationCity}%`,
            });
        }
        if (filters.departureDateFrom) {
            qb.andWhere('route.departureDate >= :from', {
                from: new Date(filters.departureDateFrom),
            });
        }
        if (filters.departureDateTo) {
            qb.andWhere('route.departureDate <= :to', {
                to: new Date(filters.departureDateTo),
            });
        }
        if (filters.minCapacityKg) {
            qb.andWhere('route.capacityKg >= :cap', { cap: filters.minCapacityKg });
        }

        const routes = await qb.getMany();

        // Post-filter by geo-radius when coordinates provided
        if (filters.originLat != null && filters.originLng != null) {
            const radius = filters.radiusKm ?? (await this.platformSettingsService.getP2pDefaultRadiusKm());
            return routes.filter((r) => {
                if (r.pickupLatitude == null || r.pickupLongitude == null) return true; // no coords = include
                const dist = haversineKm(
                    Number(r.pickupLatitude),
                    Number(r.pickupLongitude),
                    filters.originLat!,
                    filters.originLng!,
                );
                return dist <= radius;
            });
        }

        return routes;
    }

    async getRoute(id: string): Promise<P2pRoute> {
        const route = await this.routeRepo.findOne({
            where: { id },
            relations: ['courierProfile', 'courierProfile.user'],
        });
        if (!route) throw new NotFoundException('Route not found.');
        return route;
    }

    async updateRoute(userId: string, id: string, dto: UpdateRouteDto): Promise<P2pRoute> {
        const route = await this.getRoute(id);
        const profile = await this.getCourierProfile(userId);

        if (route.courier_profile_id !== profile.id) {
            throw new ForbiddenException('You do not own this route.');
        }

        Object.assign(route, {
            ...dto,
            ...(dto.departureDate ? { departureDate: new Date(dto.departureDate) } : {}),
            ...(dto.returnDate !== undefined
                ? { returnDate: dto.returnDate ? new Date(dto.returnDate) : null }
                : {}),
        });

        return this.routeRepo.save(route);
    }

    async updateRouteStatus(userId: string, id: string, dto: UpdateRouteStatusDto): Promise<P2pRoute> {
        const route = await this.getRoute(id);
        const profile = await this.getCourierProfile(userId);

        if (route.courier_profile_id !== profile.id) {
            throw new ForbiddenException('You do not own this route.');
        }

        route.status = dto.status;
        return this.routeRepo.save(route);
    }

    async getRouteFeed(
        filters: RouteFiltersDto,
    ): Promise<Array<{ route: P2pRoute; score: number }>> {
        const routes = await this.listRoutes(filters);
        const maxRadiusKm =
            filters.radiusKm ?? (await this.platformSettingsService.getP2pDefaultRadiusKm());

        const scored = routes.map((r) => ({
            route: r,
            score: scoreRoute(
                r,
                filters.destinationCountry ?? '',
                filters.destinationCity ?? '',
                filters.originLat ?? null,
                filters.originLng ?? null,
                filters.minCapacityKg ?? 1,
                maxRadiusKm,
            ),
        }));

        return scored.sort((a, b) => b.score - a.score);
    }

    /**
     * Send expiry reminder emails to couriers whose PUBLISHED routes depart
     * within the next 48 hours. Intended to be called by a scheduled task or
     * admin endpoint — not automatically on every request.
     */
    async notifyExpiringRoutes(): Promise<{ notified: number }> {
        const now = new Date();
        const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        const expiringRoutes = await this.routeRepo.find({
            where: {
                status: RouteStatus.PUBLISHED,
                departureDate: LessThanOrEqual(in48h) as any,
            },
            relations: ['courierProfile', 'courierProfile.user'],
        });

        let notified = 0;
        for (const route of expiringRoutes) {
            const courier = route.courierProfile?.user;
            if (!courier?.email) continue;

            try {
                await this.emailService.sendEmail(
                    courier.email,
                    'Your P2P Route Departs in Less Than 48 Hours',
                    `Reminder: your route to ${route.destinationCity}, ${route.destinationCountry} departs on ${new Date(route.departureDate).toDateString()}. ` +
                    `Please confirm you have coordinated with all matched seekers or close the route if you have no capacity.`,
                );
                notified++;
            } catch (err) {
                this.logger.warn(`Failed to send expiry reminder to ${courier.email}: ${err.message}`);
            }
        }

        this.logger.log(`notifyExpiringRoutes: sent ${notified} reminders`);
        return { notified };
    }
}
