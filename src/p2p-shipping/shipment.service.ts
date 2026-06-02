import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { P2pShipmentRequest } from './entities/p2p-shipment-request.entity';
import { P2pOffer } from './entities/p2p-offer.entity';
import { P2pRoute } from './entities/p2p-route.entity';
import { P2pCourierProfile } from './entities/p2p-courier-profile.entity';
import { P2pComplianceRecord } from './entities/p2p-compliance-record.entity';
import { P2pWaiver } from './entities/p2p-waiver.entity';
import { P2pCourierRequest } from './entities/p2p-courier-request.entity';
import { CourierRequestStatus, OfferStatus, RouteStatus, ShipmentRequestStatus, WaiverStatus } from './enums';
import { CreateShipmentRequestDto } from './dto/create-shipment-request.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { ConfirmPickupDto } from './dto/confirm-pickup.dto';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import { RaiseDisputeDto } from './dto/raise-dispute.dto';
import { SendCourierRequestDto } from './dto/send-courier-request.dto';
import { AcceptCourierRequestDto, DeclineCourierRequestDto } from './dto/respond-courier-request.dto';
import { EmailService } from '../notifications/email/email.service';
import { PushNotificationService } from '../notifications/push/push-notification.service';
import { MessagingService } from '../messaging/messaging.service';
import { PaymentsService } from '../payments/payments.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { haversineKm, scoreRoute } from './route.service';

/** State machine: which statuses can transition to which */
const VALID_TRANSITIONS: Record<ShipmentRequestStatus, ShipmentRequestStatus[]> = {
    [ShipmentRequestStatus.DRAFT]: [ShipmentRequestStatus.OPEN, ShipmentRequestStatus.CANCELLED],
    [ShipmentRequestStatus.OPEN]: [
        ShipmentRequestStatus.MATCHED,
        ShipmentRequestStatus.CANCELLED,
        ShipmentRequestStatus.REJECTED,
    ],
    [ShipmentRequestStatus.MATCHED]: [
        ShipmentRequestStatus.RESERVED,
        ShipmentRequestStatus.CANCELLED,
    ],
    [ShipmentRequestStatus.RESERVED]: [
        ShipmentRequestStatus.HANDOFF_PENDING,
        ShipmentRequestStatus.CANCELLED,
    ],
    [ShipmentRequestStatus.HANDOFF_PENDING]: [ShipmentRequestStatus.IN_TRANSIT],
    [ShipmentRequestStatus.IN_TRANSIT]: [ShipmentRequestStatus.DELIVERED],
    [ShipmentRequestStatus.DELIVERED]: [
        ShipmentRequestStatus.COMPLETED,
        ShipmentRequestStatus.DISPUTED,
    ],
    [ShipmentRequestStatus.COMPLETED]: [],
    [ShipmentRequestStatus.CANCELLED]: [],
    [ShipmentRequestStatus.DISPUTED]: [ShipmentRequestStatus.COMPLETED, ShipmentRequestStatus.REJECTED],
    [ShipmentRequestStatus.REJECTED]: [],
};

@Injectable()
export class ShipmentService {
    private readonly logger = new Logger(ShipmentService.name);

    constructor(
        @InjectRepository(P2pShipmentRequest)
        private requestRepo: Repository<P2pShipmentRequest>,

        @InjectRepository(P2pOffer)
        private offerRepo: Repository<P2pOffer>,

        @InjectRepository(P2pRoute)
        private routeRepo: Repository<P2pRoute>,

        @InjectRepository(P2pCourierProfile)
        private courierProfileRepo: Repository<P2pCourierProfile>,

        @InjectRepository(P2pComplianceRecord)
        private complianceRepo: Repository<P2pComplianceRecord>,

        @InjectRepository(P2pWaiver)
        private waiverRepo: Repository<P2pWaiver>,

        @InjectRepository(P2pCourierRequest)
        private courierRequestRepo: Repository<P2pCourierRequest>,

        private emailService: EmailService,
        private pushService: PushNotificationService,
        private messagingService: MessagingService,
        private paymentsService: PaymentsService,
        private platformSettingsService: PlatformSettingsService,
    ) { }

    // ──────────────────────────────── Access helpers ──────────────────────────

    /** Seeker-scoped lookup — enforces the seeker owns this shipment. */
    async getRequest(userId: string, id: string): Promise<P2pShipmentRequest> {
        const request = await this.requestRepo.findOne({
            where: { id, seeker_user_id: userId },
            relations: ['seeker'],
        });
        if (!request) throw new NotFoundException('Shipment request not found.');
        return request;
    }

    /**
     * Courier-scoped lookup — verifies the caller is the assigned courier
     * (i.e. has an ACCEPTED offer on this shipment).
     */
    async getRequestAsCourier(courierId: string, shipmentId: string): Promise<P2pShipmentRequest> {
        const courierProfile = await this.courierProfileRepo.findOne({
            where: { user_id: courierId },
        });
        if (!courierProfile) throw new ForbiddenException('No courier profile found.');

        const offer = await this.offerRepo
            .createQueryBuilder('offer')
            .innerJoin('offer.route', 'route')
            .where('offer.shipment_request_id = :sid', { sid: shipmentId })
            .andWhere('route.courier_profile_id = :cpid', { cpid: courierProfile.id })
            .andWhere('offer.status = :s', { s: OfferStatus.ACCEPTED })
            .getOne();

        if (!offer) throw new ForbiddenException('You are not the assigned courier for this shipment.');

        const request = await this.requestRepo.findOne({ where: { id: shipmentId } });
        if (!request) throw new NotFoundException('Shipment request not found.');
        return request;
    }

    /** Returns the accepted offer with courier relations for notifications. */
    private async getAcceptedOfferWithCourier(shipmentId: string): Promise<P2pOffer | null> {
        return this.offerRepo.findOne({
            where: { shipment_request_id: shipmentId, status: OfferStatus.ACCEPTED },
            relations: ['route', 'route.courierProfile', 'route.courierProfile.user'],
        });
    }

    // ──────────────────────────────── Requests ────────────────────────────────

    async createRequest(seekerId: string, dto: CreateShipmentRequestDto): Promise<P2pShipmentRequest> {
        const prohibited = await this.platformSettingsService.getP2pProhibitedItems();
        const descUpper = dto.itemDescription.toUpperCase();
        const flagged = prohibited.filter((term) => descUpper.includes(term.toUpperCase()));

        const request = this.requestRepo.create({
            seeker_user_id: seekerId,
            status: ShipmentRequestStatus.DRAFT,
            ...dto,
        });
        const saved = await this.requestRepo.save(request);

        const complianceRecord = this.complianceRepo.create({
            shipment_request_id: saved.id,
            prohibitedItemDetected: flagged.length > 0,
            restrictedCategoryFlags: flagged,
            manualReviewRequired: flagged.length > 0,
            rejectionReason: flagged.length > 0 ? `Flagged terms: ${flagged.join(', ')}` : null,
        });
        await this.complianceRepo.save(complianceRecord);

        if (flagged.length > 0) {
            await this.requestRepo.update(saved.id, { status: ShipmentRequestStatus.REJECTED });
            saved.status = ShipmentRequestStatus.REJECTED;
            throw new BadRequestException(
                `Shipment request blocked: prohibited item terms detected (${flagged.join(', ')}).`,
            );
        }

        return saved;
    }

    async listRequests(userId: string): Promise<P2pShipmentRequest[]> {
        return this.requestRepo.find({
            where: { seeker_user_id: userId },
            order: { created_at: 'DESC' },
        });
    }

    async updateRequest(
        userId: string,
        id: string,
        dto: Partial<CreateShipmentRequestDto>,
    ): Promise<P2pShipmentRequest> {
        const request = await this.getRequest(userId, id);

        if (request.status !== ShipmentRequestStatus.DRAFT) {
            throw new BadRequestException('Only DRAFT requests can be edited.');
        }

        Object.assign(request, dto);
        return this.requestRepo.save(request);
    }

    async updateStatus(
        userId: string,
        id: string,
        dto: UpdateShipmentStatusDto,
    ): Promise<P2pShipmentRequest> {
        const request = await this.getRequest(userId, id);
        const allowed = VALID_TRANSITIONS[request.status] ?? [];

        if (!allowed.includes(dto.status)) {
            throw new BadRequestException(
                `Invalid transition: ${request.status} → ${dto.status}. Allowed: [${allowed.join(', ')}]`,
            );
        }

        request.status = dto.status;
        const saved = await this.requestRepo.save(request);

        if (dto.status === ShipmentRequestStatus.OPEN) {
            this.notifyNearbyCouriersOfNewRequest(saved).catch((err) =>
                this.logger.warn(`Failed to notify nearby couriers: ${err.message}`),
            );
        }

        return saved;
    }

    /** Fire-and-forget: finds ACTIVE couriers within 50 miles of the request origin
     *  and sends each a push notification via OneSignal. */
    private async notifyNearbyCouriersOfNewRequest(request: P2pShipmentRequest): Promise<void> {
        const RADIUS_KM = 80.47;

        const profiles = await this.courierProfileRepo.find({
            where: { isActive: true },
        });

        const originLat = request.originLatitude != null ? Number(request.originLatitude) : null;
        const originLng = request.originLongitude != null ? Number(request.originLongitude) : null;

        const recipientIds = profiles
            .filter((p) => {
                if (originLat == null || originLng == null) return true;
                if (p.homeLatitude == null || p.homeLongitude == null) return false;
                return haversineKm(
                    Number(p.homeLatitude),
                    Number(p.homeLongitude),
                    originLat,
                    originLng,
                ) <= RADIUS_KM;
            })
            .map((p) => p.user_id);

        if (!recipientIds.length) return;

        const dest = `${request.destinationCity}, ${request.destinationCountry}`;
        await this.pushService.sendToUsers(
            recipientIds,
            'New shipment near you',
            `A sender needs delivery to ${dest}. Tap to view and make an offer.`,
            { type: 'P2P_MATCHED_SHIPMENT', shipment_id: request.id },
        );
    }


    // ──────────────────────────────── Matching ────────────────────────────────

    async matchRequest(
        seekerId: string,
        shipmentId: string,
    ): Promise<Array<{ route: P2pRoute; score: number }>> {
        const request = await this.getRequest(seekerId, shipmentId);
        const maxRadiusKm = await this.platformSettingsService.getP2pDefaultRadiusKm();

        const routes = await this.routeRepo.find({
            where: {
                destinationCountry: request.destinationCountry,
                status: RouteStatus.PUBLISHED,
            },
            relations: ['courierProfile', 'courierProfile.user'],
        });

        const scored = routes
            .map((r) => ({
                route: r,
                score: scoreRoute(
                    r,
                    request.destinationCountry,
                    request.destinationCity,
                    request.originLatitude,
                    request.originLongitude,
                    Number(request.weightKg),
                    maxRadiusKm,
                ),
            }))
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        await this.requestRepo.update(shipmentId, {
            matchMetadata: {
                matchedAt: new Date().toISOString(),
                topRouteIds: scored.map((s) => s.route.id),
                scores: scored.map((s) => ({ routeId: s.route.id, score: s.score })),
            } as any,
        });

        return scored;
    }

    /**
     * Returns OPEN shipment requests that:
     *   1. Destination (country + city) matches at least one of the courier's PUBLISHED routes.
     *   2. Origin is within 50 miles (≈80.5 km) of the courier's registered home location.
     *
     * Couriers with no home coordinates set skip the proximity check (condition 2 only).
     * Couriers with no PUBLISHED routes receive an empty list — they can't carry anything yet.
     */
    async listNearbyOpenShipments(courierId: string): Promise<P2pShipmentRequest[]> {
        const profile = await this.courierProfileRepo.findOne({ where: { user_id: courierId } });
        if (!profile) {
            throw new ForbiddenException('Courier profile not found. Complete your courier application first.');
        }

        const courierRoutes = await this.routeRepo.find({
            where: { courier_profile_id: profile.id, status: RouteStatus.PUBLISHED },
        });

        if (!courierRoutes.length) return [];

        const routeDestinations = courierRoutes.map((r) => ({
            country: r.destinationCountry.toLowerCase(),
            city: r.destinationCity.toLowerCase(),
        }));

        const open = await this.requestRepo.find({
            where: { status: ShipmentRequestStatus.OPEN },
            relations: ['seeker'],
            order: { created_at: 'DESC' },
        });

        const homeLat = profile.homeLatitude != null ? Number(profile.homeLatitude) : null;
        const homeLng = profile.homeLongitude != null ? Number(profile.homeLongitude) : null;
        const RADIUS_KM = 80.47; // 50 miles

        return open.filter((req) => {
            const destCountry = req.destinationCountry.toLowerCase();
            const destCity = req.destinationCity.toLowerCase();
            const hasMatchingRoute = routeDestinations.some(
                (d) => d.country === destCountry && d.city === destCity,
            );
            if (!hasMatchingRoute) return false;

            if (homeLat == null || homeLng == null) return true;
            if (req.originLatitude == null || req.originLongitude == null) return true;
            return (
                haversineKm(homeLat, homeLng, Number(req.originLatitude), Number(req.originLongitude)) <=
                RADIUS_KM
            );
        });
    }

    // ──────────────────────────────── Offers ────────────────────────────────

    async listOffersForShipment(
        userId: string,
        shipmentId: string,
    ): Promise<P2pOffer[]> {
        const request = await this.requestRepo.findOne({ where: { id: shipmentId } });
        if (!request) throw new NotFoundException('Shipment request not found.');

        if (request.seeker_user_id === userId) {
            return this.offerRepo.find({
                where: { shipment_request_id: shipmentId },
                relations: ['route', 'route.courierProfile', 'route.courierProfile.user'],
                order: { created_at: 'DESC' },
            });
        }

        const courierProfile = await this.courierProfileRepo.findOne({
            where: { user_id: userId },
        });
        if (!courierProfile) {
            throw new ForbiddenException('You cannot view offers on this shipment.');
        }

        return this.offerRepo
            .createQueryBuilder('offer')
            .innerJoinAndSelect('offer.route', 'route')
            .leftJoinAndSelect('route.courierProfile', 'cp')
            .leftJoinAndSelect('cp.user', 'cpUser')
            .where('offer.shipment_request_id = :sid', { sid: shipmentId })
            .andWhere('route.courier_profile_id = :cpid', { cpid: courierProfile.id })
            .orderBy('offer.created_at', 'DESC')
            .getMany();
    }

    async createOffer(
        courierId: string,
        shipmentId: string,
        dto: CreateOfferDto,
    ): Promise<P2pOffer> {
        const courierProfile = await this.courierProfileRepo.findOne({
            where: { user_id: courierId },
            relations: ['user'],
        });
        if (!courierProfile) throw new NotFoundException('Courier profile not found.');

        const route = await this.routeRepo.findOne({
            where: { id: dto.routeId, courier_profile_id: courierProfile.id },
        });
        if (!route) throw new NotFoundException('Route not found or not owned by this courier.');

        const request = await this.requestRepo.findOne({
            where: { id: shipmentId },
            relations: ['seeker'],
        });
        if (!request) throw new NotFoundException('Shipment request not found.');

        const existingOffer = await this.offerRepo.findOne({
            where: {
                shipment_request_id: shipmentId,
                route_id: dto.routeId,
                status: OfferStatus.PROPOSED,
            },
        });
        if (existingOffer) throw new BadRequestException('An active offer from this route already exists.');

        const offer = this.offerRepo.create({
            shipment_request_id: shipmentId,
            route_id: dto.routeId,
            offerAmountUsd: dto.offerAmountUsd ?? null,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
            status: OfferStatus.PROPOSED,
        });
        const saved = await this.offerRepo.save(offer);

        if (request.seeker?.email) {
            this.emailService
                .sendEmail(
                    request.seeker.email,
                    'New P2P Courier Offer Received',
                    `A courier has submitted an offer for your shipment request. Log in to review it.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to notify seeker on new offer: ${err.message}`),
                );
        }

        return saved;
    }

    async acceptOffer(seekerId: string, offerId: string): Promise<{ offer: P2pOffer; clientSecret: string | null }> {
        const offer = await this.offerRepo.findOne({
            where: { id: offerId },
            relations: ['shipmentRequest', 'shipmentRequest.seeker', 'route', 'route.courierProfile', 'route.courierProfile.user'],
        });
        if (!offer) throw new NotFoundException('Offer not found.');

        if (offer.shipmentRequest.seeker_user_id !== seekerId) {
            throw new ForbiddenException('You do not own this shipment request.');
        }

        if (offer.status !== OfferStatus.PROPOSED) {
            throw new BadRequestException(`Offer is no longer PROPOSED (status: ${offer.status}).`);
        }

        let clientSecret: string | null = null;

        if (offer.offerAmountUsd && Number(offer.offerAmountUsd) > 0) {
            try {
                const feePercent = await this.platformSettingsService.getP2pFeePercent();
                const amountCents = Math.round(Number(offer.offerAmountUsd) * 100);
                const platformFeeCents = Math.round(amountCents * (feePercent / 100));

                const courierConnectId: string | undefined = undefined;

                const intent = await this.paymentsService.createPaymentIntent(
                    amountCents,
                    'usd',
                    courierConnectId,
                );
                offer.paymentReference = intent.id;
                offer.paymentStatus = 'PENDING';
                clientSecret = intent.clientSecret;
                this.logger.log(
                    `Payment intent created for offer ${offerId}: ${intent.id} ` +
                    `(${offer.offerAmountUsd} USD, platform fee ${platformFeeCents} cents)`,
                );
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(`PaymentsService unavailable for offer ${offerId}: ${msg}. Recording PENDING hold.`);
                offer.paymentReference = `PENDING_MANUAL_${offerId}`;
                offer.paymentStatus = 'PENDING';
            }
        }

        offer.status = OfferStatus.ACCEPTED;
        offer.acceptedAt = new Date();
        await this.offerRepo.save(offer);

        await this.requestRepo.update(offer.shipment_request_id, {
            status: ShipmentRequestStatus.MATCHED,
        });

        await this.offerRepo
            .createQueryBuilder()
            .update(P2pOffer)
            .set({ status: OfferStatus.EXPIRED })
            .where('shipment_request_id = :sid AND id != :oid AND status = :s', {
                sid: offer.shipment_request_id,
                oid: offerId,
                s: OfferStatus.PROPOSED,
            })
            .execute();

        const courierUser = offer.route?.courierProfile?.user;
        if (courierUser?.email) {
            this.emailService
                .sendEmail(
                    courierUser.email,
                    'Your P2P Offer Was Accepted',
                    `Great news! Your offer for shipment ${offer.shipment_request_id} has been accepted. ` +
                    `The seeker must sign the risk waiver, then you will both coordinate the handoff. ` +
                    `You will receive a confirmation when the shipment is reserved.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to notify courier on offer accepted: ${err.message}`),
                );
        }

        return { offer, clientSecret };
    }

    async rejectOffer(seekerId: string, offerId: string): Promise<P2pOffer> {
        const offer = await this.offerRepo.findOne({
            where: { id: offerId },
            relations: ['shipmentRequest', 'route', 'route.courierProfile', 'route.courierProfile.user'],
        });
        if (!offer) throw new NotFoundException('Offer not found.');

        if (offer.shipmentRequest.seeker_user_id !== seekerId) {
            throw new ForbiddenException('You do not own this shipment request.');
        }

        if (offer.status !== OfferStatus.PROPOSED) {
            throw new BadRequestException('Only PROPOSED offers can be rejected.');
        }

        offer.status = OfferStatus.REJECTED;
        offer.rejectedAt = new Date();
        const saved = await this.offerRepo.save(offer);

        const courierUser = offer.route?.courierProfile?.user;
        if (courierUser?.email) {
            this.emailService
                .sendEmail(
                    courierUser.email,
                    'Your P2P Offer Was Declined',
                    `The seeker has declined your offer for shipment ${offer.shipment_request_id}. You may browse other open requests.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to notify courier on offer rejected: ${err.message}`),
                );
        }

        return saved;
    }

    // ────────────────────────── Lifecycle transitions ────────────────────────

    /**
     * MATCHED → RESERVED (seeker only).
     * Requires the seeker to have signed the waiver first.
     */
    async reserveShipment(userId: string, shipmentId: string): Promise<P2pShipmentRequest> {
        const request = await this.getRequest(userId, shipmentId);

        if (request.status !== ShipmentRequestStatus.MATCHED) {
            throw new BadRequestException(
                `Shipment must be MATCHED to reserve (current: ${request.status}).`,
            );
        }

        const waiver = await this.waiverRepo.findOne({
            where: { shipment_request_id: shipmentId, signedByUserId: userId },
        });
        if (!waiver || waiver.status !== WaiverStatus.ACCEPTED) {
            throw new BadRequestException(
                'You must sign the waiver before reserving the shipment. ' +
                'Call POST /p2p/shipments/:id/waiver/sign first.',
            );
        }

        const acceptedOffer = await this.getAcceptedOfferWithCourier(shipmentId);
        const courierEmail = acceptedOffer?.route?.courierProfile?.user?.email;

        request.status = ShipmentRequestStatus.RESERVED;
        const saved = await this.requestRepo.save(request);

        if (courierEmail) {
            this.emailService
                .sendEmail(
                    courierEmail,
                    'Shipment Reserved — Coordinate Handoff',
                    `The seeker has completed the waiver and reserved shipment ${shipmentId}. ` +
                    `Please coordinate the pickup time and location with the seeker via the in-app chat.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to notify courier on reserve: ${err.message}`),
                );
        }

        return saved;
    }

    /**
     * RESERVED → HANDOFF_PENDING (seeker or courier).
     * Generates a 6-digit pickup confirmation code and sends it to the seeker only.
     * The courier must enter this code when calling confirmPickup to prove physical handoff.
     */
    async recordHandoff(userId: string, shipmentId: string): Promise<P2pShipmentRequest> {
        // Allow either the seeker or the assigned courier to initiate handoff
        let request: P2pShipmentRequest;
        try {
            request = await this.getRequest(userId, shipmentId);
        } catch {
            request = await this.getRequestAsCourier(userId, shipmentId);
        }

        if (request.status !== ShipmentRequestStatus.RESERVED) {
            throw new BadRequestException(
                `Shipment must be RESERVED to initiate handoff (current: ${request.status}).`,
            );
        }

        const threadId = shipmentId;
        await this.messagingService.createMessage(
            threadId,
            userId,
            `Handoff initiated for shipment ${shipmentId}. Please coordinate pickup details here.`,
        );

        // Generate a 6-digit confirmation code the seeker will share verbally with the courier
        const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();

        await this.requestRepo.update(shipmentId, {
            status: ShipmentRequestStatus.HANDOFF_PENDING,
            chatThreadId: threadId,
            pickupConfirmationCode: pickupCode,
        });

        request.status = ShipmentRequestStatus.HANDOFF_PENDING;
        request.chatThreadId = threadId;
        request.pickupConfirmationCode = pickupCode;

        const fullRequest = await this.requestRepo.findOne({
            where: { id: shipmentId },
            relations: ['seeker'],
        });
        const acceptedOffer = await this.getAcceptedOfferWithCourier(shipmentId);

        const seekerEmail = fullRequest?.seeker?.email;
        const courierEmail = acceptedOffer?.route?.courierProfile?.user?.email;

        if (seekerEmail) {
            this.emailService
                .sendEmail(
                    seekerEmail,
                    'Handoff Initiated — Your Pickup Code',
                    `Your shipment (${shipmentId}) is ready for handoff.\n\n` +
                    `Your pickup confirmation code is: ${pickupCode}\n\n` +
                    `Share this code with your courier when they collect the item. ` +
                    `Do NOT share it until you physically hand over the package.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to send pickup code to seeker: ${err.message}`),
                );
        }

        if (courierEmail) {
            this.emailService
                .sendEmail(
                    courierEmail,
                    'Handoff Ready — Collect Your Package',
                    `Shipment ${shipmentId} is ready for pickup. ` +
                    `Ask the seeker for their 6-digit pickup code when you collect the item. ` +
                    `Then confirm pickup in the app to start transit.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to send handoff notice to courier: ${err.message}`),
                );
        }

        return request;
    }

    /**
     * HANDOFF_PENDING → IN_TRANSIT (courier only).
     * Courier enters the 6-digit code the seeker shared at physical pickup.
     */
    async confirmPickup(courierId: string, shipmentId: string, dto: ConfirmPickupDto): Promise<P2pShipmentRequest> {
        const request = await this.getRequestAsCourier(courierId, shipmentId);

        if (request.status !== ShipmentRequestStatus.HANDOFF_PENDING) {
            throw new BadRequestException(
                `Shipment must be HANDOFF_PENDING to confirm pickup (current: ${request.status}).`,
            );
        }

        if (request.pickupConfirmationCode !== dto.pickupConfirmationCode) {
            throw new BadRequestException('Pickup confirmation code is incorrect.');
        }

        await this.requestRepo.update(shipmentId, {
            status: ShipmentRequestStatus.IN_TRANSIT,
            pickupConfirmationCode: null, // invalidate after use
        });

        request.status = ShipmentRequestStatus.IN_TRANSIT;
        request.pickupConfirmationCode = null;

        const fullRequest = await this.requestRepo.findOne({
            where: { id: shipmentId },
            relations: ['seeker'],
        });
        const seekerEmail = fullRequest?.seeker?.email;

        if (seekerEmail) {
            this.emailService
                .sendEmail(
                    seekerEmail,
                    'Your Package Is In Transit',
                    `Your shipment (${shipmentId}) has been picked up and is now in transit. ` +
                    `You will be notified when it is delivered.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to notify seeker on pickup: ${err.message}`),
                );
        }

        return request;
    }

    /**
     * IN_TRANSIT → DELIVERED (courier only).
     * Courier can optionally attach proof-of-delivery photo URLs.
     */
    async confirmDelivery(courierId: string, shipmentId: string, dto: ConfirmDeliveryDto): Promise<P2pShipmentRequest> {
        const request = await this.getRequestAsCourier(courierId, shipmentId);

        if (request.status !== ShipmentRequestStatus.IN_TRANSIT) {
            throw new BadRequestException(
                `Shipment must be IN_TRANSIT to confirm delivery (current: ${request.status}).`,
            );
        }

        const now = new Date();
        await this.requestRepo.update(shipmentId, {
            status: ShipmentRequestStatus.DELIVERED,
            deliveredAt: now,
            proofOfDeliveryUrls: dto.proofOfDeliveryUrls ?? null,
        });

        request.status = ShipmentRequestStatus.DELIVERED;
        request.deliveredAt = now;
        request.proofOfDeliveryUrls = dto.proofOfDeliveryUrls ?? null;

        const fullRequest = await this.requestRepo.findOne({
            where: { id: shipmentId },
            relations: ['seeker'],
        });
        const seekerEmail = fullRequest?.seeker?.email;
        const acceptedOffer = await this.getAcceptedOfferWithCourier(shipmentId);
        const courierEmail = acceptedOffer?.route?.courierProfile?.user?.email;

        if (seekerEmail) {
            this.emailService
                .sendEmail(
                    seekerEmail,
                    'Your P2P Shipment Has Been Delivered',
                    `Your shipment (${shipmentId}) has been marked as delivered by your courier.\n\n` +
                    `Please open the app to confirm receipt. Once you confirm, payment will be released to the courier. ` +
                    `If there is an issue, you can raise a dispute instead.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to notify seeker on delivery: ${err.message}`),
                );
        }

        if (courierEmail) {
            this.emailService
                .sendEmail(
                    courierEmail,
                    'Delivery Marked — Awaiting Seeker Confirmation',
                    `You have marked shipment ${shipmentId} as delivered. ` +
                    `Payment will be released once the seeker confirms receipt.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to notify courier on delivery: ${err.message}`),
                );
        }

        return request;
    }

    /**
     * DELIVERED → COMPLETED (seeker only).
     * Seeker confirms receipt of the item — triggers payout release and review prompts.
     */
    async completeShipment(seekerId: string, shipmentId: string): Promise<P2pShipmentRequest> {
        const request = await this.getRequest(seekerId, shipmentId);

        if (request.status !== ShipmentRequestStatus.DELIVERED) {
            throw new BadRequestException(
                `Shipment must be DELIVERED to complete (current: ${request.status}).`,
            );
        }

        const now = new Date();
        await this.requestRepo.update(shipmentId, {
            status: ShipmentRequestStatus.COMPLETED,
            completedAt: now,
        });

        request.status = ShipmentRequestStatus.COMPLETED;
        request.completedAt = now;

        // Release payment to courier
        const acceptedOffer = await this.getAcceptedOfferWithCourier(shipmentId);
        if (acceptedOffer?.paymentReference) {
            this.paymentsService
                .releaseFunds(shipmentId)
                .then(() =>
                    this.logger.log(`Payout released for shipment ${shipmentId} (ref: ${acceptedOffer.paymentReference})`),
                )
                .catch((err) =>
                    this.logger.warn(`Payout release failed for ${shipmentId}: ${err.message}. Requires manual reconciliation.`),
                );
        }

        const fullRequest = await this.requestRepo.findOne({
            where: { id: shipmentId },
            relations: ['seeker'],
        });
        const seekerEmail = fullRequest?.seeker?.email;
        const courierUser = acceptedOffer?.route?.courierProfile?.user;
        const courierEmail = courierUser?.email;
        const courierUserId = courierUser?.id;

        if (seekerEmail) {
            this.emailService
                .sendEmail(
                    seekerEmail,
                    'Delivery Confirmed — Please Leave a Review',
                    `Thank you for confirming receipt of shipment ${shipmentId}. ` +
                    `We hope everything arrived in great condition! ` +
                    `Please take a moment to rate your courier — your feedback helps the community.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to send completion email to seeker: ${err.message}`),
                );
        }

        if (courierEmail) {
            this.emailService
                .sendEmail(
                    courierEmail,
                    'Payment Released — Delivery Complete!',
                    `The seeker has confirmed receipt of shipment ${shipmentId}. ` +
                    `Your payment has been released. Thank you for completing this delivery! ` +
                    `Don't forget to leave a review for the seeker.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to send completion email to courier: ${err.message}`),
                );
        }

        this.logger.log(
            `Shipment ${shipmentId} completed. Seeker: ${seekerId}, Courier user: ${courierUserId ?? 'unknown'}.`,
        );

        return request;
    }

    /**
     * DELIVERED → DISPUTED (seeker only).
     * Seeker raises a dispute instead of confirming receipt.
     */
    async raiseDispute(seekerId: string, shipmentId: string, dto: RaiseDisputeDto): Promise<P2pShipmentRequest> {
        const request = await this.getRequest(seekerId, shipmentId);

        if (request.status !== ShipmentRequestStatus.DELIVERED) {
            throw new BadRequestException(
                `Disputes can only be raised when shipment is DELIVERED (current: ${request.status}).`,
            );
        }

        await this.requestRepo.update(shipmentId, {
            status: ShipmentRequestStatus.DISPUTED,
            matchMetadata: {
                ...(request.matchMetadata ?? {}),
                dispute: {
                    raisedAt: new Date().toISOString(),
                    reason: dto.reason,
                    evidenceUrls: dto.evidenceUrls ?? [],
                },
            } as any,
        });

        request.status = ShipmentRequestStatus.DISPUTED;

        const acceptedOffer = await this.getAcceptedOfferWithCourier(shipmentId);
        const courierEmail = acceptedOffer?.route?.courierProfile?.user?.email;
        const fullRequest = await this.requestRepo.findOne({
            where: { id: shipmentId },
            relations: ['seeker'],
        });
        const seekerEmail = fullRequest?.seeker?.email;

        if (courierEmail) {
            this.emailService
                .sendEmail(
                    courierEmail,
                    'Dispute Raised on Shipment',
                    `The seeker has raised a dispute on shipment ${shipmentId}. ` +
                    `Reason: "${dto.reason}". Our team will review and contact both parties shortly. ` +
                    `Payment is on hold pending resolution.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to notify courier on dispute: ${err.message}`),
                );
        }

        if (seekerEmail) {
            this.emailService
                .sendEmail(
                    seekerEmail,
                    'Dispute Filed — We Will Review',
                    `Your dispute for shipment ${shipmentId} has been received. ` +
                    `Our team will review the case and reach out within 24-48 hours.`,
                )
                .catch((err) =>
                    this.logger.warn(`Failed to send dispute confirmation to seeker: ${err.message}`),
                );
        }

        this.logger.warn(`Dispute raised on shipment ${shipmentId} by seeker ${seekerId}: ${dto.reason}`);

        return request;
    }

    // ──────────────────────────── Courier Requests ───────────────────────────
    // Customer sends a direct request to a specific courier's route.
    // The courier then accepts (auto-creates an offer) or declines.

    /**
     * Seeker sends a direct booking request to a specific courier route.
     * Allowed when the shipment is DRAFT or OPEN.
     */
    async sendCourierRequest(
        seekerId: string,
        shipmentId: string,
        dto: SendCourierRequestDto,
    ): Promise<P2pCourierRequest> {
        const request = await this.getRequest(seekerId, shipmentId);

        const allowedStatuses: ShipmentRequestStatus[] = [
            ShipmentRequestStatus.DRAFT,
            ShipmentRequestStatus.OPEN,
        ];
        if (!allowedStatuses.includes(request.status)) {
            throw new BadRequestException(
                `Cannot send a courier request when shipment is ${request.status}. ` +
                `Shipment must be DRAFT or OPEN.`,
            );
        }

        const route = await this.routeRepo.findOne({
            where: { id: dto.routeId, status: RouteStatus.PUBLISHED },
            relations: ['courierProfile', 'courierProfile.user'],
        });
        if (!route) throw new NotFoundException('Route not found or not available.');

        const existing = await this.courierRequestRepo.findOne({
            where: {
                shipment_request_id: shipmentId,
                route_id: dto.routeId,
                status: CourierRequestStatus.PENDING,
            },
        });
        if (existing) {
            throw new BadRequestException('A pending request to this courier already exists for this shipment.');
        }

        // Default expiry: 48 hours from now
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48);

        const courierRequest = this.courierRequestRepo.create({
            shipment_request_id: shipmentId,
            route_id: dto.routeId,
            seeker_user_id: seekerId,
            message: dto.message ?? null,
            status: CourierRequestStatus.PENDING,
            expiresAt,
        });
        const saved = await this.courierRequestRepo.save(courierRequest);

        const courierEmail = route.courierProfile?.user?.email;
        if (courierEmail) {
            this.emailService
                .sendEmail(
                    courierEmail,
                    'New Shipment Request — A Sender Wants You',
                    `A sender has selected your route and sent you a direct shipment request to ` +
                    `${request.destinationCity}, ${request.destinationCountry}. ` +
                    `Log in to your dashboard to review and accept or decline.` +
                    (dto.message ? `\n\nMessage from sender: "${dto.message}"` : ''),
                )
                .catch((err) =>
                    this.logger.warn(`Failed to notify courier of new request: ${err.message}`),
                );
        }

        return saved;
    }

    /** Seeker lists all courier requests sent for a specific shipment. */
    async listCourierRequestsForShipment(
        seekerId: string,
        shipmentId: string,
    ): Promise<P2pCourierRequest[]> {
        await this.getRequest(seekerId, shipmentId); // ownership check
        return this.courierRequestRepo.find({
            where: { shipment_request_id: shipmentId },
            relations: ['route', 'route.courierProfile', 'route.courierProfile.user'],
            order: { created_at: 'DESC' },
        });
    }

    /** Seeker cancels a pending courier request. */
    async cancelCourierRequest(
        seekerId: string,
        shipmentId: string,
        requestId: string,
    ): Promise<P2pCourierRequest> {
        await this.getRequest(seekerId, shipmentId); // ownership check
        const courierRequest = await this.courierRequestRepo.findOne({
            where: { id: requestId, shipment_request_id: shipmentId },
        });
        if (!courierRequest) throw new NotFoundException('Courier request not found.');
        if (courierRequest.status !== CourierRequestStatus.PENDING) {
            throw new BadRequestException('Only PENDING requests can be cancelled.');
        }
        courierRequest.status = CourierRequestStatus.CANCELLED;
        return this.courierRequestRepo.save(courierRequest);
    }

    /** Courier lists all incoming PENDING requests on their dashboard. */
    async listIncomingCourierRequests(courierId: string): Promise<P2pCourierRequest[]> {
        const courierProfile = await this.courierProfileRepo.findOne({
            where: { user_id: courierId },
        });
        if (!courierProfile) throw new NotFoundException('Courier profile not found.');

        return this.courierRequestRepo
            .createQueryBuilder('cr')
            .innerJoinAndSelect('cr.route', 'route')
            .innerJoinAndSelect('cr.shipmentRequest', 'shipment')
            .leftJoinAndSelect('cr.seeker', 'seeker')
            .where('route.courier_profile_id = :cpid', { cpid: courierProfile.id })
            .orderBy('cr.created_at', 'DESC')
            .getMany();
    }

    /**
     * Courier accepts a direct request.
     * Creates a P2pOffer (PROPOSED) so the seeker can formally confirm and payment can be held.
     */
    async acceptCourierRequest(
        courierId: string,
        requestId: string,
        dto: AcceptCourierRequestDto,
    ): Promise<{ courierRequest: P2pCourierRequest; offer: P2pOffer }> {
        const courierProfile = await this.courierProfileRepo.findOne({
            where: { user_id: courierId },
            relations: ['user'],
        });
        if (!courierProfile) throw new NotFoundException('Courier profile not found.');

        const courierRequest = await this.courierRequestRepo.findOne({
            where: { id: requestId },
            relations: ['route', 'shipmentRequest', 'shipmentRequest.seeker'],
        });
        if (!courierRequest) throw new NotFoundException('Courier request not found.');

        if (courierRequest.route.courier_profile_id !== courierProfile.id) {
            throw new ForbiddenException('This request is not for one of your routes.');
        }

        if (courierRequest.status !== CourierRequestStatus.PENDING) {
            throw new BadRequestException(
                `Only PENDING requests can be accepted (current: ${courierRequest.status}).`,
            );
        }

        if (courierRequest.expiresAt && courierRequest.expiresAt < new Date()) {
            courierRequest.status = CourierRequestStatus.EXPIRED;
            await this.courierRequestRepo.save(courierRequest);
            throw new BadRequestException('This courier request has expired.');
        }

        // Check no offer already exists from this route on this shipment
        const existingOffer = await this.offerRepo.findOne({
            where: {
                shipment_request_id: courierRequest.shipment_request_id,
                route_id: courierRequest.route_id,
                status: OfferStatus.PROPOSED,
            },
        });
        if (existingOffer) {
            throw new BadRequestException('An active offer from this route already exists.');
        }

        const now = new Date();
        courierRequest.status = CourierRequestStatus.ACCEPTED;
        courierRequest.respondedAt = now;
        await this.courierRequestRepo.save(courierRequest);

        // Auto-create the offer on behalf of the courier
        const offer = this.offerRepo.create({
            shipment_request_id: courierRequest.shipment_request_id,
            route_id: courierRequest.route_id,
            offerAmountUsd: dto.offerAmountUsd ?? null,
            status: OfferStatus.PROPOSED,
        });
        const savedOffer = await this.offerRepo.save(offer);

        const seekerEmail = courierRequest.shipmentRequest?.seeker?.email;
        if (seekerEmail) {
            this.emailService
                .sendEmail(
                    seekerEmail,
                    'Your Courier Request Was Accepted',
                    `Your direct courier request has been accepted! The courier has submitted an offer for your shipment. ` +
                    `Log in to review the offer and confirm the match.` +
                    (dto.message ? `\n\nMessage from courier: "${dto.message}"` : ''),
                )
                .catch((err) =>
                    this.logger.warn(`Failed to notify seeker on courier request accepted: ${err.message}`),
                );
        }

        return { courierRequest, offer: savedOffer };
    }

    /** Courier declines a direct request. */
    async declineCourierRequest(
        courierId: string,
        requestId: string,
        dto: DeclineCourierRequestDto,
    ): Promise<P2pCourierRequest> {
        const courierProfile = await this.courierProfileRepo.findOne({
            where: { user_id: courierId },
        });
        if (!courierProfile) throw new NotFoundException('Courier profile not found.');

        const courierRequest = await this.courierRequestRepo.findOne({
            where: { id: requestId },
            relations: ['route', 'shipmentRequest', 'shipmentRequest.seeker'],
        });
        if (!courierRequest) throw new NotFoundException('Courier request not found.');

        if (courierRequest.route.courier_profile_id !== courierProfile.id) {
            throw new ForbiddenException('This request is not for one of your routes.');
        }

        if (courierRequest.status !== CourierRequestStatus.PENDING) {
            throw new BadRequestException(
                `Only PENDING requests can be declined (current: ${courierRequest.status}).`,
            );
        }

        courierRequest.status = CourierRequestStatus.DECLINED;
        courierRequest.declineReason = dto.reason ?? null;
        courierRequest.respondedAt = new Date();
        const saved = await this.courierRequestRepo.save(courierRequest);

        const seekerEmail = courierRequest.shipmentRequest?.seeker?.email;
        if (seekerEmail) {
            this.emailService
                .sendEmail(
                    seekerEmail,
                    'Courier Declined Your Request',
                    `Unfortunately the courier was unable to accept your shipment request at this time. ` +
                    `You can browse other available couriers and send a new request.` +
                    (dto.reason ? `\n\nCourier's reason: "${dto.reason}"` : ''),
                )
                .catch((err) =>
                    this.logger.warn(`Failed to notify seeker on courier request declined: ${err.message}`),
                );
        }

        return saved;
    }
}
