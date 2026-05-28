import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { P2pCourierProfile } from './entities/p2p-courier-profile.entity';
import { P2pRoute } from './entities/p2p-route.entity';
import { P2pReview } from './entities/p2p-review.entity';
import { CourierVerificationState, RouteStatus } from './enums';
import { CreateCourierProfileDto } from './dto/create-courier-profile.dto';
import { UpdateCourierProfileDto } from './dto/update-courier-profile.dto';

@Injectable()
export class CourierService {
    constructor(
        @InjectRepository(P2pCourierProfile)
        private courierProfileRepo: Repository<P2pCourierProfile>,

        @InjectRepository(P2pReview)
        private reviewRepo: Repository<P2pReview>,

        @InjectRepository(P2pRoute)
        private routeRepo: Repository<P2pRoute>,
    ) { }

    async applyAsCourier(userId: string, dto: CreateCourierProfileDto): Promise<P2pCourierProfile> {
        const existing = await this.courierProfileRepo.findOne({ where: { user_id: userId } });
        if (existing) {
            throw new ConflictException('A courier profile already exists for this user.');
        }

        const profile = this.courierProfileRepo.create({
            user_id: userId,
            verificationState: CourierVerificationState.DRAFT,
            isActive: false,
            payoutReady: false,
            rating: 0,
            ...dto,
        });

        return this.courierProfileRepo.save(profile);
    }

    async getMyProfile(userId: string): Promise<P2pCourierProfile> {
        const profile = await this.courierProfileRepo.findOne({
            where: { user_id: userId },
            relations: ['user'],
        });
        if (!profile) {
            throw new NotFoundException('Courier profile not found.');
        }
        return profile;
    }

    async updateMyProfile(userId: string, dto: UpdateCourierProfileDto): Promise<P2pCourierProfile> {
        const profile = await this.getMyProfile(userId);
        Object.assign(profile, dto);
        return this.courierProfileRepo.save(profile);
    }

    async approveMyProfileForTesting(userId: string): Promise<P2pCourierProfile> {
        const profile = await this.getMyProfile(userId);

        profile.verificationState = CourierVerificationState.APPROVED;
        profile.isActive = false;

        return this.courierProfileRepo.save(profile);
    }

    async setAvailability(userId: string, isActive: boolean): Promise<P2pCourierProfile> {
        const profile = await this.getMyProfile(userId);

        const allowedStates = [
            CourierVerificationState.APPROVED,
            CourierVerificationState.ACTIVE,
        ];

        if (!allowedStates.includes(profile.verificationState)) {
            throw new BadRequestException(
                `Cannot set availability. Profile must be in APPROVED state first (current: ${profile.verificationState}).`,
            );
        }

        profile.isActive = isActive;
        profile.verificationState = isActive
            ? CourierVerificationState.ACTIVE
            : CourierVerificationState.APPROVED;

        return this.courierProfileRepo.save(profile);
    }

    async getStatus(userId: string): Promise<{ verificationState: string; isActive: boolean; payoutReady: boolean }> {
        const profile = await this.getMyProfile(userId);
        return {
            verificationState: profile.verificationState,
            isActive: profile.isActive,
            payoutReady: profile.payoutReady,
        };
    }

    async getPublicProfile(courierId: string): Promise<P2pCourierProfile> {
        const profile = await this.courierProfileRepo.findOne({
            where: { id: courierId },
            relations: ['user'],
        });
        if (!profile) throw new NotFoundException('Courier profile not found.');

        const visible = [
            CourierVerificationState.APPROVED,
            CourierVerificationState.ACTIVE,
            CourierVerificationState.SUSPENDED,
        ];
        if (!visible.includes(profile.verificationState)) {
            throw new NotFoundException('Courier profile not found.');
        }
        return profile;
    }

    async listPublicCouriers(filters: {
        destinationCountry?: string;
        destinationCity?: string;
        limit?: number;
    }): Promise<P2pCourierProfile[]> {
        const limit = Math.min(filters.limit ?? 20, 100);

        // If destination filters are provided, restrict to couriers with at least
        // one PUBLISHED route into that destination.
        let courierIds: string[] | null = null;
        if (filters.destinationCountry || filters.destinationCity) {
            const qb = this.routeRepo
                .createQueryBuilder('route')
                .select('DISTINCT route.courier_profile_id', 'courier_profile_id')
                .where('route.status = :status', { status: RouteStatus.PUBLISHED });

            if (filters.destinationCountry) {
                qb.andWhere('LOWER(route.destinationCountry) LIKE LOWER(:country)', {
                    country: `%${filters.destinationCountry}%`,
                });
            }
            if (filters.destinationCity) {
                qb.andWhere('LOWER(route.destinationCity) LIKE LOWER(:city)', {
                    city: `%${filters.destinationCity}%`,
                });
            }

            const rows: Array<{ courier_profile_id: string }> = await qb.getRawMany();
            courierIds = rows.map((r) => r.courier_profile_id).filter(Boolean);
            if (courierIds.length === 0) return [];
        }

        const visibleStates = [
            CourierVerificationState.APPROVED,
            CourierVerificationState.ACTIVE,
        ];

        return this.courierProfileRepo.find({
            where: {
                verificationState: In(visibleStates),
                ...(courierIds ? { id: In(courierIds) } : {}),
            },
            relations: ['user'],
            order: { rating: 'DESC', created_at: 'DESC' },
            take: limit,
        });
    }

    async getReputation(courierId: string): Promise<{
        averageRating: number;
        reviewCount: number;
        recentReviews: P2pReview[];
    }> {
        const profile = await this.courierProfileRepo.findOne({ where: { id: courierId } });
        if (!profile) {
            throw new NotFoundException('Courier profile not found.');
        }

        const reviews = await this.reviewRepo.find({
            where: { reviewedUserId: profile.user_id },
            order: { created_at: 'DESC' },
            take: 10,
        });

        const total = reviews.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = reviews.length > 0 ? Math.round((total / reviews.length) * 100) / 100 : 0;

        // Keep profile rating in sync
        if (reviews.length > 0 && profile.rating !== averageRating) {
            await this.courierProfileRepo.update(courierId, { rating: averageRating });
        }

        return {
            averageRating,
            reviewCount: reviews.length,
            recentReviews: reviews,
        };
    }
}
