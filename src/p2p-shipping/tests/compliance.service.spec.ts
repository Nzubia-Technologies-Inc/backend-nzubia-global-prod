import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ComplianceService } from '../compliance.service';
import { P2pComplianceRecord } from '../entities/p2p-compliance-record.entity';
import { P2pWaiver } from '../entities/p2p-waiver.entity';
import { P2pShipmentRequest } from '../entities/p2p-shipment-request.entity';
import { ItemCategory, ShipmentRequestStatus, WaiverStatus } from '../enums';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { DocumentsService } from '../../documents/documents.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeShipment(id = 'shipment-1'): P2pShipmentRequest {
    return {
        id,
        seeker_user_id: 'user-1',
        originAddress: '1 Test St',
        originLatitude: null,
        originLongitude: null,
        destinationCountry: 'US',
        destinationCity: 'New York',
        itemCategory: ItemCategory.CLOTHING,
        itemDescription: 'Some clothes',
        dimensionsCm: null,
        weightKg: 2,
        declaredValueUsd: 100,
        photoUrls: null,
        status: ShipmentRequestStatus.OPEN,
        matchMetadata: null,
        created_at: new Date(),
        updated_at: new Date(),
        seeker: undefined as any,
    } as P2pShipmentRequest;
}

function makeWaiver(overrides: Partial<P2pWaiver> = {}): P2pWaiver {
    return {
        id: 'waiver-1',
        shipment_request_id: 'shipment-1',
        signedByUserId: 'user-1',
        termsVersion: '1.0',
        acknowledgedFlags: ['NO_PROHIBITED_ITEMS'],
        proofMetadata: null,
        status: WaiverStatus.ACCEPTED,
        created_at: new Date(),
        updated_at: new Date(),
        shipmentRequest: undefined as any,
        user: undefined as any,
        ...overrides,
    } as P2pWaiver;
}

// ─── Mock builders ───────────────────────────────────────────────────────────

function makeComplianceRepo() {
    return {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((dto) => ({ id: 'compliance-1', ...dto })),
        save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };
}

function makeWaiverRepo(existingWaiver?: P2pWaiver) {
    return {
        findOne: jest.fn().mockResolvedValue(existingWaiver ?? null),
        find: jest.fn().mockResolvedValue(existingWaiver ? [existingWaiver] : []),
        create: jest.fn().mockImplementation((dto) => ({ id: 'waiver-new', ...dto })),
        save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
        update: jest.fn().mockResolvedValue(undefined),
    };
}

function makeRequestRepo(shipment?: P2pShipmentRequest) {
    return {
        findOne: jest.fn().mockResolvedValue(shipment ?? null),
    };
}

const makePlatformSettings = (waiverText = 'Test waiver text', version = '1.0') => ({
    getP2pWaiverText: jest.fn().mockResolvedValue(waiverText),
    getP2pWaiverVersion: jest.fn().mockResolvedValue(version),
    getP2pFeePercent: jest.fn().mockResolvedValue(10),
    getP2pDefaultRadiusKm: jest.fn().mockResolvedValue(50),
    getP2pProhibitedItems: jest.fn().mockResolvedValue(['WEAPONS', 'DRUGS']),
    getP2pRestrictedCategories: jest.fn().mockResolvedValue(['DOCUMENTS', 'CLOTHING', 'ELECTRONICS', 'OTHER']),
    getP2pMaxDeclaredValueUsd: jest.fn().mockResolvedValue(5000),
    getP2pMaxWeightKg: jest.fn().mockResolvedValue(50),
});

const makeDocumentsService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
});

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('ComplianceService', () => {
    let service: ComplianceService;

    let complianceRepo: ReturnType<typeof makeComplianceRepo>;
    let waiverRepo: ReturnType<typeof makeWaiverRepo>;
    let requestRepo: ReturnType<typeof makeRequestRepo>;
    let platformSettings: ReturnType<typeof makePlatformSettings>;

    async function buildModule(opts: {
        shipment?: P2pShipmentRequest;
        existingWaiver?: P2pWaiver;
        waiverText?: string;
        waiverVersion?: string;
    } = {}) {
        complianceRepo = makeComplianceRepo();
        waiverRepo = makeWaiverRepo(opts.existingWaiver);
        requestRepo = makeRequestRepo(opts.shipment ?? makeShipment());
        platformSettings = makePlatformSettings(
            opts.waiverText ?? 'Default waiver text from platform settings',
            opts.waiverVersion ?? '1.0',
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ComplianceService,
                { provide: getRepositoryToken(P2pComplianceRecord), useValue: complianceRepo },
                { provide: getRepositoryToken(P2pWaiver), useValue: waiverRepo },
                { provide: getRepositoryToken(P2pShipmentRequest), useValue: requestRepo },
                { provide: PlatformSettingsService, useValue: platformSettings },
                { provide: DocumentsService, useValue: makeDocumentsService() },
            ],
        }).compile();

        service = module.get<ComplianceService>(ComplianceService);
    }

    // ── acceptWaiver ───────────────────────────────────────────────────────

    describe('acceptWaiver', () => {
        const dto = {
            acknowledgedFlags: [
                'NO_PROHIBITED_ITEMS',
                'ACCURATE_VALUE_DECLARED',
                'CUSTOMS_RESPONSIBILITY',
                'MARKETPLACE_DISCLAIMER',
            ],
        };

        it('creates a waiver record with ACCEPTED status', async () => {
            await buildModule();

            const result = await service.acceptWaiver('user-1', 'shipment-1', dto);

            expect(waiverRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    shipment_request_id: 'shipment-1',
                    signedByUserId: 'user-1',
                    status: WaiverStatus.ACCEPTED,
                    acknowledgedFlags: dto.acknowledgedFlags,
                }),
            );
            expect(result.status).toBe(WaiverStatus.ACCEPTED);
        });

        it('stores the current platform terms version on the waiver', async () => {
            await buildModule({ waiverVersion: '2.5' });

            const result = await service.acceptWaiver('user-1', 'shipment-1', dto);

            expect(result.termsVersion).toBe('2.5');
        });

        it('expires existing waiver(s) before creating a new one when called twice', async () => {
            const existingWaiver = makeWaiver({ status: WaiverStatus.ACCEPTED });
            await buildModule({ existingWaiver });

            // First call created in prior state; now calling again
            const result = await service.acceptWaiver('user-1', 'shipment-1', dto);

            // Old waivers should be expired
            expect(waiverRepo.update).toHaveBeenCalledWith(
                { shipment_request_id: 'shipment-1', signedByUserId: 'user-1' },
                { status: WaiverStatus.EXPIRED },
            );

            // New waiver is ACCEPTED
            expect(result.status).toBe(WaiverStatus.ACCEPTED);
        });

        it('throws NotFoundException when the shipment does not exist', async () => {
            await buildModule({ shipment: undefined });
            requestRepo.findOne.mockResolvedValue(null);

            await expect(service.acceptWaiver('user-1', 'no-such-shipment', dto)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ── previewWaiver ──────────────────────────────────────────────────────

    describe('previewWaiver', () => {
        it('returns the waiver text stored in platform settings', async () => {
            const waiverText = 'You agree not to ship prohibited items and accept customs responsibility.';
            await buildModule({ waiverText });

            const result = await service.previewWaiver('shipment-1');

            expect(result.waiverText).toBe(waiverText);
        });

        it('returns the current terms version from platform settings', async () => {
            await buildModule({ waiverVersion: '3.0' });

            const result = await service.previewWaiver('shipment-1');

            expect(result.termsVersion).toBe('3.0');
        });

        it('returns the shipmentId in the response', async () => {
            await buildModule();

            const result = await service.previewWaiver('shipment-1');

            expect(result.shipmentId).toBe('shipment-1');
        });

        it('returns the standard acknowledge flags', async () => {
            await buildModule();

            const result = await service.previewWaiver('shipment-1');

            expect(result.acknowledgeFlags).toContain('NO_PROHIBITED_ITEMS');
            expect(result.acknowledgeFlags).toContain('CUSTOMS_RESPONSIBILITY');
        });

        it('throws NotFoundException when shipment does not exist', async () => {
            await buildModule({ shipment: undefined });
            requestRepo.findOne.mockResolvedValue(null);

            await expect(service.previewWaiver('no-such-shipment')).rejects.toThrow(NotFoundException);
        });
    });

    // ── getRules ───────────────────────────────────────────────────────────

    describe('getRules', () => {
        it('returns a record with platformFeePercent, defaultRadiusKm, and waiverVersion', async () => {
            await buildModule();

            const rules = await service.getRules();

            expect(rules).toHaveProperty('platformFeePercent');
            expect(rules).toHaveProperty('defaultRadiusKm');
            expect(rules).toHaveProperty('waiverVersion');
        });
    });

    // ── getRestrictedItems ─────────────────────────────────────────────────

    describe('getRestrictedItems', () => {
        it('returns the prohibited item list from platform settings', async () => {
            await buildModule();

            const result = await service.getRestrictedItems();

            expect(result.items).toContain('WEAPONS');
            expect(result.items).toContain('DRUGS');
        });
    });
});
