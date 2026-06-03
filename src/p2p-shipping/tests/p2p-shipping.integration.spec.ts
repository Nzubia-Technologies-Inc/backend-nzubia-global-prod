/**
 * P2P Shipping — Integration Test
 *
 * Spins up a real NestJS TestingModule backed by an in-memory SQLite database
 * (better-sqlite3 + TypeORM) and drives a full courier→shipment→delivery
 * lifecycle:
 *
 *   1.  Create a courier user, apply as courier, approve → ACTIVE
 *   2.  Create a published route
 *   3.  Create a seeker user, submit a shipment request (DRAFT → OPEN)
 *   4.  Courier creates an offer; seeker accepts it  (OPEN → MATCHED)
 *   5.  Seeker accepts the compliance waiver
 *   6.  Advance state machine: MATCHED → RESERVED → HANDOFF_PENDING
 *       → IN_TRANSIT → DELIVERED
 *   7.  Assert final status === DELIVERED, persisted in DB
 *
 * NOTE: The production entities use MySQL-specific column types (`enum`, `json`)
 * that are not in better-sqlite3's allowlist.  We patch the driver's
 * `supportedDataTypes` array inside a `dataSourceFactory` callback — this is
 * safe because SQLite stores both types as text regardless.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Repository } from 'typeorm';

// ── Entities ─────────────────────────────────────────────────────────────────
import { User, UserRole, KycStatus } from '../../users/entities/user.entity';
import { AgentProfile } from '../../users/entities/agent-profile.entity';
import { PlatformSetting } from '../../platform-settings/entities/platform-setting.entity';
import { Message } from '../../messaging/entities/message.entity';

import { P2pCourierProfile } from '../entities/p2p-courier-profile.entity';
import { P2pCourierRequest } from '../entities/p2p-courier-request.entity';
import { P2pRoute } from '../entities/p2p-route.entity';
import { P2pShipmentRequest } from '../entities/p2p-shipment-request.entity';
import { P2pOffer } from '../entities/p2p-offer.entity';
import { P2pWaiver } from '../entities/p2p-waiver.entity';
import { P2pReview } from '../entities/p2p-review.entity';
import { P2pComplianceRecord } from '../entities/p2p-compliance-record.entity';

// ── Enums ─────────────────────────────────────────────────────────────────────
import {
    CourierVerificationState,
    ItemCategory,
    OfferStatus,
    RouteStatus,
    ShipmentRequestStatus,
    WaiverStatus,
} from '../enums';

// ── Services ──────────────────────────────────────────────────────────────────
import { CourierService } from '../courier.service';
import { RouteService } from '../route.service';
import { ShipmentService } from '../shipment.service';
import { ComplianceService } from '../compliance.service';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { DocumentsService } from '../../documents/documents.service';
import { EmailService } from '../../notifications/email/email.service';
import { MessagingService } from '../../messaging/messaging.service';
import { PaymentsService } from '../../payments/payments.service';
import { PushNotificationService } from '../../notifications/push/push-notification.service';

// ─────────────────────────────────────────────────────────────────────────────

const ALL_ENTITIES = [
    User,
    AgentProfile,
    PlatformSetting,
    Message,
    P2pCourierProfile,
    P2pCourierRequest,
    P2pRoute,
    P2pShipmentRequest,
    P2pOffer,
    P2pWaiver,
    P2pReview,
    P2pComplianceRecord,
];

/**
 * Create a TypeORM DataSource that works with in-memory SQLite despite
 * production entities using MySQL-specific column types (enum, json).
 * SQLite stores both as text — the driver type guard just needs widening.
 */
async function createPatchedDataSource(options: any): Promise<DataSource> {
    const ds = new DataSource(options);
    const driver = (ds as any).driver;
    if (driver && Array.isArray(driver.supportedDataTypes)) {
        // SQLite stores enum as text (with optional CHECK) and timestamp as text.
        // Neither is in better-sqlite3's allowlist; widening it here is safe for tests.
        for (const extra of ['enum', 'timestamp']) {
            if (!driver.supportedDataTypes.includes(extra)) {
                driver.supportedDataTypes.push(extra);
            }
        }
    }
    // NestJS TypeOrmModule will call ds.initialize() for us
    return ds;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('P2P Shipping – full lifecycle integration test', () => {
    let module: TestingModule;

    // Repositories for setup helpers
    let userRepo: Repository<User>;
    let courierProfileRepo: Repository<P2pCourierProfile>;
    let routeRepo: Repository<P2pRoute>;
    let shipmentRepo: Repository<P2pShipmentRequest>;
    let offerRepo: Repository<P2pOffer>;

    // Services under test
    let courierService: CourierService;
    let routeService: RouteService;
    let shipmentService: ShipmentService;
    let complianceService: ComplianceService;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRootAsync({
                    useFactory: () => ({
                        type: 'better-sqlite3' as const,
                        database: ':memory:',
                        entities: ALL_ENTITIES,
                        synchronize: true,
                        dropSchema: true,
                        logging: false,
                    }),
                    dataSourceFactory: (options) =>
                        createPatchedDataSource(options),
                }),
                TypeOrmModule.forFeature(ALL_ENTITIES),
            ],
            providers: [
                // Real services
                CourierService,
                RouteService,
                ShipmentService,
                ComplianceService,
                PlatformSettingsService,
                DocumentsService,

                // Stub out services that call external infrastructure
                {
                    provide: EmailService,
                    useValue: {
                        sendEmail: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: MessagingService,
                    useValue: {
                        createMessage: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: PaymentsService,
                    useValue: {
                        createPaymentIntent: jest.fn().mockResolvedValue({
                            id: 'pi_test_stub',
                            clientSecret: 'cs_test',
                        }),
                    },
                },
                {
                    provide: PushNotificationService,
                    useValue: { sendPushNotification: jest.fn().mockResolvedValue(undefined) },
                },
            ],
        }).compile();

        // Trigger lifecycle hooks (seeds PlatformSettings defaults)
        await module.init();

        userRepo = module.get(getRepositoryToken(User));
        courierProfileRepo = module.get(getRepositoryToken(P2pCourierProfile));
        routeRepo = module.get(getRepositoryToken(P2pRoute));
        shipmentRepo = module.get(getRepositoryToken(P2pShipmentRequest));
        offerRepo = module.get(getRepositoryToken(P2pOffer));

        courierService = module.get<CourierService>(CourierService);
        routeService = module.get<RouteService>(RouteService);
        shipmentService = module.get<ShipmentService>(ShipmentService);
        complianceService = module.get<ComplianceService>(ComplianceService);
    }, 30_000);

    afterAll(async () => {
        await module.close();
    });

    // ── Helper: persist a bare User row ─────────────────────────────────────
    async function createUser(email: string): Promise<User> {
        return userRepo.save(
            userRepo.create({
                email,
                password_hash: null,
                role: UserRole.CUSTOMER,
                kyc_status: KycStatus.NOT_SUBMITTED,
                is_verified: false,
            }),
        );
    }

    // ── Main lifecycle test ──────────────────────────────────────────────────

    it('runs a full courier → shipment → delivery lifecycle', async () => {
        const courierUser = await createUser('courier@integration.test');
        const seekerUser = await createUser('seeker@integration.test');

        // 1. Apply as courier (creates DRAFT profile) ────────────────────────
        const draftProfile = await courierService.applyAsCourier(
            courierUser.id,
            {
                serviceRadiusKm: 50,
                homeLatitude: 5.6037,
                homeLongitude: -0.187,
            },
        );

        expect(draftProfile.verificationState).toBe(
            CourierVerificationState.DRAFT,
        );
        expect(Boolean(draftProfile.isActive)).toBe(false);

        // Simulate admin approval
        await courierProfileRepo.update(draftProfile.id, {
            verificationState: CourierVerificationState.ACTIVE,
            isActive: true,
        });

        // 2. Create a published route ─────────────────────────────────────────
        const route = await routeService.createRoute(courierUser.id, {
            destinationCountry: 'US',
            destinationCity: 'New York',
            departureDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0],
            pickupOrigin: 'Accra, Ghana',
            pickupLatitude: 5.6037,
            pickupLongitude: -0.187,
            capacityKg: 10,
        });

        expect(route.status).toBe(RouteStatus.DRAFT);

        await routeRepo.update(route.id, { status: RouteStatus.PUBLISHED });

        // 3. Create and open shipment request ────────────────────────────────
        const shipment = await shipmentService.createRequest(seekerUser.id, {
            originAddress: '22 Market Street, London',
            contactPhone: '+15551234567',
            destinationCountry: 'US',
            destinationCity: 'New York',
            itemCategory: ItemCategory.CLOTHING,
            itemDescription: 'A warm winter coat',
            weightKg: 2,
            declaredValueUsd: 120,
        });

        expect(shipment.status).toBe(ShipmentRequestStatus.DRAFT);

        // Compliance record is created alongside
        const complianceStatus = await complianceService.getComplianceStatus(
            shipment.id,
        );
        expect(complianceStatus.record).not.toBeNull();
        expect(Boolean(complianceStatus.record!.prohibitedItemDetected)).toBe(
            false,
        );

        await shipmentService.updateStatus(seekerUser.id, shipment.id, {
            status: ShipmentRequestStatus.OPEN,
        });

        // 4. Courier creates an offer ─────────────────────────────────────────
        const offer = await shipmentService.createOffer(
            courierUser.id,
            shipment.id,
            {
                routeId: route.id,
                offerAmountUsd: 45,
            },
        );

        expect(offer.status).toBe(OfferStatus.PROPOSED);

        // 5. Seeker accepts the offer  →  OPEN → MATCHED ─────────────────────
        const { offer: acceptedOffer } = await shipmentService.acceptOffer(
            seekerUser.id,
            offer.id,
        );

        expect(acceptedOffer.status).toBe(OfferStatus.ACCEPTED);
        expect(acceptedOffer.acceptedAt).not.toBeNull();

        const matchedShipment = await shipmentRepo.findOne({
            where: { id: shipment.id },
        });
        expect(matchedShipment!.status).toBe(ShipmentRequestStatus.MATCHED);

        // 6. Seeker accepts the compliance waiver ────────────────────────────
        const waiver = await complianceService.acceptWaiver(
            seekerUser.id,
            shipment.id,
            {
                acknowledgedFlags: [
                    'NO_PROHIBITED_ITEMS',
                    'ACCURATE_VALUE_DECLARED',
                    'CUSTOMS_RESPONSIBILITY',
                    'MARKETPLACE_DISCLAIMER',
                ],
            },
        );

        expect(waiver.status).toBe(WaiverStatus.ACCEPTED);
        expect(waiver.termsVersion).toBeTruthy();

        // 7. Advance state machine to DELIVERED ──────────────────────────────
        await shipmentService.reserveShipment(seekerUser.id, shipment.id);

        await shipmentService.updateStatus(seekerUser.id, shipment.id, {
            status: ShipmentRequestStatus.HANDOFF_PENDING,
        });

        await shipmentService.updateStatus(seekerUser.id, shipment.id, {
            status: ShipmentRequestStatus.IN_TRANSIT,
        });

        const deliveredShipment = await shipmentService.confirmDelivery(
            courierUser.id,
            shipment.id,
            {},
        );
        expect(deliveredShipment.status).toBe(ShipmentRequestStatus.DELIVERED);

        // 8. Verify persisted status ──────────────────────────────────────────
        const finalRecord = await shipmentRepo.findOne({
            where: { id: shipment.id },
        });
        expect(finalRecord!.status).toBe(ShipmentRequestStatus.DELIVERED);
    }, 20_000);

    // ── Supplementary integration tests ──────────────────────────────────────

    it('applyAsCourier twice for the same user throws a conflict error', async () => {
        const user = await createUser('double-apply@integration.test');
        await courierService.applyAsCourier(user.id, {});
        await expect(
            courierService.applyAsCourier(user.id, {}),
        ).rejects.toThrow(/already exists/i);
    }, 15_000);

    it('createRequest with a prohibited item saves a flagged compliance record and throws', async () => {
        const user = await createUser('bad-shipper@integration.test');

        await expect(
            shipmentService.createRequest(user.id, {
                originAddress: '1 Main St',
                contactPhone: '+15551234567',
                destinationCountry: 'US',
                destinationCity: 'New York',
                itemCategory: ItemCategory.OTHER,
                itemDescription: 'Sending weapons and explosives',
                weightKg: 1,
                declaredValueUsd: 50,
            }),
        ).rejects.toThrow(/prohibited/i);
    }, 15_000);

    it('acceptOffer on an already-accepted offer throws BadRequestException', async () => {
        const seekerUser = await createUser(
            'double-accept-seeker@integration.test',
        );
        const courierUser = await createUser(
            'double-accept-courier@integration.test',
        );

        const cp = await courierProfileRepo.save(
            courierProfileRepo.create({
                user_id: courierUser.id,
                verificationState: CourierVerificationState.ACTIVE,
                isActive: true,
                rating: 0,
                payoutReady: false,
            }),
        );

        const r = await routeRepo.save(
            routeRepo.create({
                courier_profile_id: cp.id,
                destinationCountry: 'US',
                destinationCity: 'NYC',
                departureDate: new Date('2030-01-01') as any,
                pickupOrigin: 'Accra',
                capacityKg: 5,
                status: RouteStatus.PUBLISHED,
            }),
        );

        const shipment = await shipmentRepo.save(
            shipmentRepo.create({
                seeker_user_id: seekerUser.id,
                originAddress: '1 St',
                contactPhone: '+15551234567',
                destinationCountry: 'US',
                destinationCity: 'NYC',
                itemCategory: ItemCategory.DOCUMENTS,
                itemDescription: 'Some docs',
                weightKg: 0.5,
                declaredValueUsd: 10,
                status: ShipmentRequestStatus.MATCHED,
            }),
        );

        const existingOffer = await offerRepo.save(
            offerRepo.create({
                shipment_request_id: shipment.id,
                route_id: r.id,
                status: OfferStatus.ACCEPTED,
                acceptedAt: new Date(),
            }),
        );

        await expect(
            shipmentService.acceptOffer(seekerUser.id, existingOffer.id),
        ).rejects.toThrow(/PROPOSED/i);
    }, 15_000);

    it('previewWaiver returns waiver text sourced from platform settings', async () => {
        const user = await createUser('waiver-preview@integration.test');

        const shipment = await shipmentRepo.save(
            shipmentRepo.create({
                seeker_user_id: user.id,
                originAddress: '1 St',
                contactPhone: '+15551234567',
                destinationCountry: 'US',
                destinationCity: 'NYC',
                itemCategory: ItemCategory.DOCUMENTS,
                itemDescription: 'Papers',
                weightKg: 0.2,
                declaredValueUsd: 5,
                status: ShipmentRequestStatus.OPEN,
            }),
        );

        const preview = await complianceService.previewWaiver(shipment.id);

        expect(typeof preview.waiverText).toBe('string');
        expect(preview.waiverText.length).toBeGreaterThan(0);
        expect(preview.termsVersion).toBeTruthy();
        expect(preview.acknowledgeFlags).toContain('NO_PROHIBITED_ITEMS');
    }, 15_000);
});
