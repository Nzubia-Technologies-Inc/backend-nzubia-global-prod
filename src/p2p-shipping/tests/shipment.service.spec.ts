import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { ShipmentService } from '../shipment.service';
import { P2pShipmentRequest } from '../entities/p2p-shipment-request.entity';
import { P2pOffer } from '../entities/p2p-offer.entity';
import { P2pRoute } from '../entities/p2p-route.entity';
import { P2pCourierProfile } from '../entities/p2p-courier-profile.entity';
import { P2pComplianceRecord } from '../entities/p2p-compliance-record.entity';
import { P2pWaiver } from '../entities/p2p-waiver.entity';
import { P2pCourierRequest } from '../entities/p2p-courier-request.entity';
import {
    CourierVerificationState,
    ItemCategory,
    OfferStatus,
    RouteStatus,
    ShipmentRequestStatus,
} from '../enums';
import { EmailService } from '../../notifications/email/email.service';
import { MessagingService } from '../../messaging/messaging.service';
import { PaymentsService } from '../../payments/payments.service';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { PushNotificationService } from '../../notifications/push/push-notification.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCourierProfile(
    overrides: Partial<P2pCourierProfile> = {},
): P2pCourierProfile {
    return {
        id: 'profile-1',
        user_id: 'courier-user-1',
        verificationState: CourierVerificationState.ACTIVE,
        rating: 4,
        isActive: true,
        homeLatitude: null,
        homeLongitude: null,
        serviceRadiusKm: null,
        acceptedCategories: null,
        payoutReady: false,
        reputationSummary: null,
        created_at: new Date(),
        updated_at: new Date(),
        user: { id: 'courier-user-1', email: 'courier@example.com' } as any,
        ...overrides,
    } as P2pCourierProfile;
}

function makeShipment(
    overrides: Partial<P2pShipmentRequest> = {},
): P2pShipmentRequest {
    return {
        id: 'shipment-1',
        seeker_user_id: 'seeker-1',
        originAddress: '1 Test St',
        contactPhone: '+15551234567',
        originLatitude: null,
        originLongitude: null,
        destinationCountry: 'US',
        destinationCity: 'New York',
        itemCategory: ItemCategory.CLOTHING,
        itemDescription: 'A nice jacket',
        dimensionsCm: null,
        weightKg: 2,
        declaredValueUsd: 100,
        photoUrls: null,
        status: ShipmentRequestStatus.OPEN,
        matchMetadata: null,
        chatThreadId: null,
        created_at: new Date(),
        updated_at: new Date(),
        seeker: { id: 'seeker-1', email: 'seeker@example.com' } as any,
        ...overrides,
    } as P2pShipmentRequest;
}

function makeOffer(overrides: Partial<P2pOffer> = {}): P2pOffer {
    return {
        id: 'offer-1',
        shipment_request_id: 'shipment-1',
        route_id: 'route-1',
        offerAmountUsd: 50,
        status: OfferStatus.PROPOSED,
        acceptedAt: null,
        rejectedAt: null,
        expiresAt: null,
        paymentReference: null,
        paymentStatus: null,
        created_at: new Date(),
        updated_at: new Date(),
        shipmentRequest: makeShipment(),
        route: {
            id: 'route-1',
            courier_profile_id: 'profile-1',
            courierProfile: makeCourierProfile(),
        } as any,
        ...overrides,
    } as P2pOffer;
}

// ─── Repo mock builder ───────────────────────────────────────────────────────

function makeRequestRepo(shipment?: P2pShipmentRequest) {
    return {
        create: jest.fn().mockImplementation((dto) => ({ ...dto })),
        save: jest
            .fn()
            .mockImplementation((e) =>
                Promise.resolve({ id: 'shipment-new', ...e }),
            ),
        findOne: jest.fn().mockResolvedValue(shipment ?? null),
        find: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(undefined),
    };
}

function makeOfferRepo(offer?: P2pOffer) {
    const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
        getOne: jest.fn().mockResolvedValue(offer ?? null),
        getMany: jest.fn().mockResolvedValue([]),
    };
    return {
        create: jest.fn().mockImplementation((dto) => ({ ...dto })),
        save: jest
            .fn()
            .mockImplementation((e) =>
                Promise.resolve({ id: 'offer-new', ...e }),
            ),
        findOne: jest.fn().mockResolvedValue(offer ?? null),
        createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
}

function makeWaiverRepo(waiver?: P2pWaiver) {
    return {
        create: jest.fn().mockImplementation((dto) => ({ ...dto })),
        save: jest
            .fn()
            .mockImplementation((e) =>
                Promise.resolve({ id: 'waiver-1', ...e }),
            ),
        findOne: jest.fn().mockResolvedValue(waiver ?? null),
        update: jest.fn().mockResolvedValue(undefined),
    };
}

function makeRouteRepo(route?: P2pRoute) {
    return {
        findOne: jest.fn().mockResolvedValue(route ?? null),
        find: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn().mockReturnValue({
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
        }),
    };
}

function makeCourierProfileRepo(profile?: P2pCourierProfile) {
    return {
        findOne: jest.fn().mockResolvedValue(profile ?? null),
    };
}

function makeComplianceRepo() {
    return {
        create: jest.fn().mockImplementation((dto) => ({ ...dto })),
        save: jest
            .fn()
            .mockImplementation((e) =>
                Promise.resolve({ id: 'compliance-1', ...e }),
            ),
        findOne: jest.fn().mockResolvedValue(null),
    };
}

function makeCourierRequestRepo() {
    return {
        create: jest.fn().mockImplementation((dto) => ({ ...dto })),
        save: jest
            .fn()
            .mockImplementation((e) =>
                Promise.resolve({ id: 'courier-request-1', ...e }),
            ),
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(undefined),
    };
}

const makePlatformSettings = (prohibitedItems: string[] = []) => ({
    getP2pProhibitedItems: jest.fn().mockResolvedValue(prohibitedItems),
    getP2pDefaultRadiusKm: jest.fn().mockResolvedValue(50),
    getP2pFeePercent: jest.fn().mockResolvedValue(10),
});

const makeEmailService = () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
});
const makePushService = () => ({
    sendToUser: jest.fn().mockResolvedValue(undefined),
    sendToUsers: jest.fn().mockResolvedValue(undefined),
});
const makeMessagingService = () => ({
    createMessage: jest.fn().mockResolvedValue(undefined),
});
const makePaymentsService = () => ({
    createPaymentIntent: jest
        .fn()
        .mockResolvedValue({ id: 'pi_test_123', clientSecret: 'secret' }),
});

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('ShipmentService', () => {
    let service: ShipmentService;

    let requestRepo: ReturnType<typeof makeRequestRepo>;
    let offerRepo: ReturnType<typeof makeOfferRepo>;
    let routeRepo: ReturnType<typeof makeRouteRepo>;
    let courierProfileRepo: ReturnType<typeof makeCourierProfileRepo>;
    let complianceRepo: ReturnType<typeof makeComplianceRepo>;
    let waiverRepo: ReturnType<typeof makeWaiverRepo>;
    let courierRequestRepo: ReturnType<typeof makeCourierRequestRepo>;
    let platformSettings: ReturnType<typeof makePlatformSettings>;
    let emailService: ReturnType<typeof makeEmailService>;
    let pushService: ReturnType<typeof makePushService>;
    let messagingService: ReturnType<typeof makeMessagingService>;
    let paymentsService: ReturnType<typeof makePaymentsService>;

    async function buildModule(
        opts: {
            shipment?: P2pShipmentRequest;
            offer?: P2pOffer;
            route?: P2pRoute;
            courierProfile?: P2pCourierProfile;
            waiver?: P2pWaiver;
            prohibitedItems?: string[];
        } = {},
    ) {
        requestRepo = makeRequestRepo(opts.shipment);
        offerRepo = makeOfferRepo(opts.offer);
        routeRepo = makeRouteRepo(opts.route);
        courierProfileRepo = makeCourierProfileRepo(opts.courierProfile);
        complianceRepo = makeComplianceRepo();
        waiverRepo = makeWaiverRepo(opts.waiver);
        courierRequestRepo = makeCourierRequestRepo();
        platformSettings = makePlatformSettings(opts.prohibitedItems ?? []);
        emailService = makeEmailService();
        pushService = makePushService();
        messagingService = makeMessagingService();
        paymentsService = makePaymentsService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ShipmentService,
                {
                    provide: getRepositoryToken(P2pShipmentRequest),
                    useValue: requestRepo,
                },
                { provide: getRepositoryToken(P2pOffer), useValue: offerRepo },
                { provide: getRepositoryToken(P2pRoute), useValue: routeRepo },
                {
                    provide: getRepositoryToken(P2pCourierProfile),
                    useValue: courierProfileRepo,
                },
                {
                    provide: getRepositoryToken(P2pComplianceRecord),
                    useValue: complianceRepo,
                },
                {
                    provide: getRepositoryToken(P2pWaiver),
                    useValue: waiverRepo,
                },
                {
                    provide: getRepositoryToken(P2pCourierRequest),
                    useValue: courierRequestRepo,
                },
                { provide: EmailService, useValue: emailService },
                { provide: PushNotificationService, useValue: pushService },
                { provide: MessagingService, useValue: messagingService },
                { provide: PaymentsService, useValue: paymentsService },
                {
                    provide: PlatformSettingsService,
                    useValue: platformSettings,
                },
            ],
        }).compile();

        service = module.get<ShipmentService>(ShipmentService);
    }

    // ── createRequest ──────────────────────────────────────────────────────

    describe('createRequest', () => {
        const dto = {
            originAddress: '1 Test St',
            contactPhone: '+15551234567',
            destinationCountry: 'US',
            destinationCity: 'New York',
            itemCategory: ItemCategory.CLOTHING,
            itemDescription: 'A nice jacket',
            weightKg: 2,
            declaredValueUsd: 100,
        };

        it('creates a compliance record alongside the shipment request', async () => {
            await buildModule();

            await service.createRequest('seeker-1', dto);

            expect(complianceRepo.save).toHaveBeenCalledTimes(1);
            expect(complianceRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    prohibitedItemDetected: false,
                    manualReviewRequired: false,
                }),
            );
        });

        it('sets prohibitedItemDetected = true and throws when description contains a prohibited term', async () => {
            await buildModule({ prohibitedItems: ['WEAPONS', 'DRUGS'] });

            const badDto = { ...dto, itemDescription: 'Some drugs and stuff' };

            await expect(
                service.createRequest('seeker-1', badDto),
            ).rejects.toThrow(BadRequestException);

            expect(complianceRepo.save).toHaveBeenCalledTimes(1);
            expect(complianceRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    prohibitedItemDetected: true,
                    manualReviewRequired: true,
                }),
            );
        });

        it('flags multiple prohibited terms in the rejection reason', async () => {
            await buildModule({
                prohibitedItems: ['WEAPONS', 'DRUGS', 'EXPLOSIVES'],
            });

            const badDto = {
                ...dto,
                itemDescription: 'sending explosives and drugs',
            };

            await expect(
                service.createRequest('seeker-1', badDto),
            ).rejects.toThrow(/DRUGS|EXPLOSIVES/i);
        });

        it('saves the request with DRAFT status on clean description', async () => {
            await buildModule();

            await service.createRequest('seeker-1', dto);

            expect(requestRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: ShipmentRequestStatus.DRAFT,
                }),
            );
        });
    });

    // ── updateStatus (state machine) ───────────────────────────────────────

    describe('updateStatus – state machine', () => {
        it('allows DRAFT → OPEN transition', async () => {
            const shipment = makeShipment({
                status: ShipmentRequestStatus.DRAFT,
            });
            await buildModule({ shipment });

            requestRepo.save.mockResolvedValue({
                ...shipment,
                status: ShipmentRequestStatus.OPEN,
            });

            const result = await service.updateStatus(
                'seeker-1',
                'shipment-1',
                {
                    status: ShipmentRequestStatus.OPEN,
                },
            );

            expect(result.status).toBe(ShipmentRequestStatus.OPEN);
        });

        it('allows OPEN → MATCHED transition', async () => {
            const shipment = makeShipment({
                status: ShipmentRequestStatus.OPEN,
            });
            await buildModule({ shipment });

            requestRepo.save.mockResolvedValue({
                ...shipment,
                status: ShipmentRequestStatus.MATCHED,
            });

            const result = await service.updateStatus(
                'seeker-1',
                'shipment-1',
                {
                    status: ShipmentRequestStatus.MATCHED,
                },
            );

            expect(result.status).toBe(ShipmentRequestStatus.MATCHED);
        });

        it('rejects OPEN → DELIVERED (skipping intermediate states)', async () => {
            const shipment = makeShipment({
                status: ShipmentRequestStatus.OPEN,
            });
            await buildModule({ shipment });

            await expect(
                service.updateStatus('seeker-1', 'shipment-1', {
                    status: ShipmentRequestStatus.DELIVERED,
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('rejects DRAFT → DELIVERED transition', async () => {
            const shipment = makeShipment({
                status: ShipmentRequestStatus.DRAFT,
            });
            await buildModule({ shipment });

            await expect(
                service.updateStatus('seeker-1', 'shipment-1', {
                    status: ShipmentRequestStatus.DELIVERED,
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('rejects DELIVERED → OPEN (backwards) transition', async () => {
            const shipment = makeShipment({
                status: ShipmentRequestStatus.DELIVERED,
            });
            await buildModule({ shipment });

            await expect(
                service.updateStatus('seeker-1', 'shipment-1', {
                    status: ShipmentRequestStatus.OPEN,
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('rejects COMPLETED → any transition (terminal state)', async () => {
            const shipment = makeShipment({
                status: ShipmentRequestStatus.COMPLETED,
            });
            await buildModule({ shipment });

            await expect(
                service.updateStatus('seeker-1', 'shipment-1', {
                    status: ShipmentRequestStatus.DELIVERED,
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws NotFoundException for unknown shipment id', async () => {
            await buildModule(); // requestRepo.findOne returns null

            await expect(
                service.updateStatus('seeker-1', 'no-such-id', {
                    status: ShipmentRequestStatus.OPEN,
                }),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ── acceptOffer ────────────────────────────────────────────────────────

    describe('acceptOffer', () => {
        it('transitions offer to ACCEPTED and shipment to MATCHED', async () => {
            const offer = makeOffer({
                status: OfferStatus.PROPOSED,
                shipmentRequest: makeShipment({
                    seeker_user_id: 'seeker-1',
                    status: ShipmentRequestStatus.OPEN,
                }),
            });

            await buildModule({ offer });

            offerRepo.save.mockResolvedValue({
                ...offer,
                status: OfferStatus.ACCEPTED,
                acceptedAt: new Date(),
            });

            const result = await service.acceptOffer('seeker-1', 'offer-1');

            expect(result.offer.status).toBe(OfferStatus.ACCEPTED);
            expect(result.offer.acceptedAt).not.toBeNull();
            expect(requestRepo.update).toHaveBeenCalledWith(
                offer.shipment_request_id,
                expect.objectContaining({
                    status: ShipmentRequestStatus.MATCHED,
                }),
            );
        });

        it('creates a payment intent and stores the reference when offerAmountUsd is set', async () => {
            const offer = makeOffer({
                status: OfferStatus.PROPOSED,
                offerAmountUsd: 75,
                shipmentRequest: makeShipment({ seeker_user_id: 'seeker-1' }),
            });

            await buildModule({ offer });

            offerRepo.save.mockImplementation((e) => Promise.resolve({ ...e }));

            await service.acceptOffer('seeker-1', 'offer-1');

            // Payment intent should have been created for 7500 cents
            expect(paymentsService.createPaymentIntent).toHaveBeenCalledWith(
                7500, // 75 * 100
                'usd',
                undefined, // no Connect ID yet
            );

            // paymentReference and paymentStatus should be set before save
            const savedOffer = offerRepo.save.mock.calls[0][0];
            expect(savedOffer.paymentReference).toBe('pi_test_123');
            expect(savedOffer.paymentStatus).toBe('PENDING');
        });

        it('stores a PENDING_MANUAL reference when PaymentsService throws', async () => {
            const offer = makeOffer({
                status: OfferStatus.PROPOSED,
                offerAmountUsd: 50,
                shipmentRequest: makeShipment({ seeker_user_id: 'seeker-1' }),
            });

            await buildModule({ offer });

            paymentsService.createPaymentIntent.mockRejectedValue(
                new Error('Stripe unavailable'),
            );
            offerRepo.save.mockImplementation((e) => Promise.resolve({ ...e }));

            // Should NOT throw — payment failure is non-blocking
            await expect(
                service.acceptOffer('seeker-1', 'offer-1'),
            ).resolves.not.toThrow();

            const savedOffer = offerRepo.save.mock.calls[0][0];
            expect(savedOffer.paymentReference).toMatch(/^PENDING_MANUAL_/);
            expect(savedOffer.paymentStatus).toBe('PENDING');
        });

        it('skips payment intent when offerAmountUsd is null', async () => {
            const offer = makeOffer({
                status: OfferStatus.PROPOSED,
                offerAmountUsd: null,
                shipmentRequest: makeShipment({ seeker_user_id: 'seeker-1' }),
            });

            await buildModule({ offer });
            offerRepo.save.mockImplementation((e) => Promise.resolve({ ...e }));

            await service.acceptOffer('seeker-1', 'offer-1');

            expect(paymentsService.createPaymentIntent).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when offer is already ACCEPTED', async () => {
            const alreadyAccepted = makeOffer({ status: OfferStatus.ACCEPTED });
            await buildModule({ offer: alreadyAccepted });

            await expect(
                service.acceptOffer('seeker-1', 'offer-1'),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.acceptOffer('seeker-1', 'offer-1'),
            ).rejects.toThrow(/PROPOSED/);
        });

        it('throws BadRequestException when offer is EXPIRED', async () => {
            const expired = makeOffer({ status: OfferStatus.EXPIRED });
            await buildModule({ offer: expired });

            await expect(
                service.acceptOffer('seeker-1', 'offer-1'),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws ForbiddenException when the caller does not own the shipment', async () => {
            const offer = makeOffer({
                shipmentRequest: makeShipment({ seeker_user_id: 'real-owner' }),
            });

            await buildModule({ offer });

            await expect(
                service.acceptOffer('wrong-user', 'offer-1'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('throws NotFoundException when offer does not exist', async () => {
            await buildModule(); // offerRepo.findOne returns null

            await expect(
                service.acceptOffer('seeker-1', 'no-offer'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ── rejectOffer ────────────────────────────────────────────────────────

    describe('rejectOffer', () => {
        it('transitions offer to REJECTED', async () => {
            const offer = makeOffer({ status: OfferStatus.PROPOSED });
            await buildModule({ offer });

            offerRepo.save.mockResolvedValue({
                ...offer,
                status: OfferStatus.REJECTED,
                rejectedAt: new Date(),
            });

            const result = await service.rejectOffer('seeker-1', 'offer-1');

            expect(result.status).toBe(OfferStatus.REJECTED);
            expect(result.rejectedAt).not.toBeNull();
        });

        it('sends a rejection notification email to the courier', async () => {
            const offer = makeOffer({ status: OfferStatus.PROPOSED });
            await buildModule({ offer });

            offerRepo.save.mockResolvedValue({
                ...offer,
                status: OfferStatus.REJECTED,
                rejectedAt: new Date(),
            });

            await service.rejectOffer('seeker-1', 'offer-1');

            expect(emailService.sendEmail).toHaveBeenCalledWith(
                'courier@example.com',
                expect.stringContaining('Declined'),
                expect.any(String),
            );
        });

        it('throws BadRequestException when offer is not PROPOSED', async () => {
            const offer = makeOffer({ status: OfferStatus.ACCEPTED });
            await buildModule({ offer });

            await expect(
                service.rejectOffer('seeker-1', 'offer-1'),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.rejectOffer('seeker-1', 'offer-1'),
            ).rejects.toThrow(/PROPOSED/);
        });

        it('throws ForbiddenException when caller does not own the shipment', async () => {
            const offer = makeOffer({
                shipmentRequest: makeShipment({ seeker_user_id: 'real-owner' }),
            });

            await buildModule({ offer });

            await expect(
                service.rejectOffer('wrong-user', 'offer-1'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('throws NotFoundException when offer does not exist', async () => {
            await buildModule(); // offerRepo.findOne returns null

            await expect(
                service.rejectOffer('seeker-1', 'no-offer'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ── recordHandoff ──────────────────────────────────────────────────────

    describe('recordHandoff', () => {
        it('stores the chatThreadId on the shipment request', async () => {
            // First findOne (inside updateStatus → getRequest) must return RESERVED
            const shipment = makeShipment({
                status: ShipmentRequestStatus.RESERVED,
            });
            await buildModule({ shipment }); // sets default findOne → RESERVED

            requestRepo.save.mockResolvedValue({
                ...shipment,
                status: ShipmentRequestStatus.HANDOFF_PENDING,
            });
            // Second findOne call (notification seeker lookup) — no email needed for this assertion
            requestRepo.findOne
                .mockResolvedValueOnce(shipment) // getRequest call
                .mockResolvedValue({ ...shipment, seeker: null });
            offerRepo.findOne.mockResolvedValue(null);

            await service.recordHandoff('seeker-1', 'shipment-1');

            expect(requestRepo.update).toHaveBeenCalledWith(
                'shipment-1',
                expect.objectContaining({ chatThreadId: 'shipment-1' }),
            );
        });

        it('creates a messaging thread using the shipment ID as room', async () => {
            const shipment = makeShipment({
                status: ShipmentRequestStatus.RESERVED,
            });
            await buildModule({ shipment });

            requestRepo.save.mockResolvedValue({
                ...shipment,
                status: ShipmentRequestStatus.HANDOFF_PENDING,
            });
            requestRepo.findOne
                .mockResolvedValueOnce(shipment)
                .mockResolvedValue({ ...shipment, seeker: null });
            offerRepo.findOne.mockResolvedValue(null);

            await service.recordHandoff('seeker-1', 'shipment-1');

            expect(messagingService.createMessage).toHaveBeenCalledWith(
                'shipment-1',
                'seeker-1',
                expect.stringContaining('shipment-1'),
            );
        });

        it('sends handoff reminder emails to both seeker and courier', async () => {
            const shipment = makeShipment({
                status: ShipmentRequestStatus.RESERVED,
            });
            await buildModule({ shipment });

            requestRepo.save.mockResolvedValue({
                ...shipment,
                status: ShipmentRequestStatus.HANDOFF_PENDING,
            });
            // First call = getRequest (RESERVED); second = notification lookup (with seeker email)
            requestRepo.findOne
                .mockResolvedValueOnce(shipment)
                .mockResolvedValue({
                    ...shipment,
                    seeker: { email: 'seeker@example.com' },
                });

            const offerWithCourier = makeOffer({
                status: OfferStatus.ACCEPTED,
                route: {
                    courierProfile: {
                        user: { email: 'courier@example.com' },
                    },
                } as any,
            });
            offerRepo.findOne.mockResolvedValue(offerWithCourier);

            await service.recordHandoff('seeker-1', 'shipment-1');

            const emailCalls = emailService.sendEmail.mock.calls.map(
                (c) => c[0],
            );
            expect(emailCalls).toContain('seeker@example.com');
            expect(emailCalls).toContain('courier@example.com');
        });
    });

    // ── confirmDelivery ────────────────────────────────────────────────────

    describe('confirmDelivery', () => {
        it('sends delivery confirmation to both seeker and courier', async () => {
            const shipment = makeShipment({
                status: ShipmentRequestStatus.IN_TRANSIT,
            });
            const courierProfile = makeCourierProfile();
            const offerWithCourier = makeOffer({
                status: OfferStatus.ACCEPTED,
                route: {
                    courier_profile_id: courierProfile.id,
                    courierProfile: {
                        user: { email: 'courier@example.com' },
                    },
                } as any,
            });

            await buildModule({
                shipment,
                courierProfile,
                offer: offerWithCourier,
            });

            // getRequestAsCourier: courierProfileRepo already returns courierProfile via buildModule.
            // offerRepo qb getOne returns offerWithCourier (set via buildModule offer option).
            // requestRepo.findOne: first call returns shipment (for getRequestAsCourier), second returns with seeker.
            requestRepo.findOne
                .mockResolvedValueOnce(shipment)
                .mockResolvedValue({
                    ...shipment,
                    seeker: { email: 'seeker@example.com' },
                });

            requestRepo.update.mockResolvedValue(undefined);

            // getAcceptedOfferWithCourier uses findOne
            offerRepo.findOne.mockResolvedValue(offerWithCourier);

            await service.confirmDelivery('courier-user-1', 'shipment-1', {});

            const emailCalls = emailService.sendEmail.mock.calls.map(
                (c) => c[0],
            );
            expect(emailCalls).toContain('seeker@example.com');
            expect(emailCalls).toContain('courier@example.com');
        });
    });
});
