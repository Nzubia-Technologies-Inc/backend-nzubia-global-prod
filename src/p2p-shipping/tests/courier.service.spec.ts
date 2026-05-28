import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CourierService } from '../courier.service';
import { P2pCourierProfile } from '../entities/p2p-courier-profile.entity';
import { P2pRoute } from '../entities/p2p-route.entity';
import { P2pReview } from '../entities/p2p-review.entity';
import { CourierVerificationState } from '../enums';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSavedProfile(overrides: Partial<P2pCourierProfile> = {}): P2pCourierProfile {
    return {
        id: 'profile-1',
        user_id: 'user-1',
        verificationState: CourierVerificationState.DRAFT,
        rating: 0,
        isActive: false,
        homeLatitude: null,
        homeLongitude: null,
        serviceRadiusKm: null,
        acceptedCategories: null,
        payoutReady: false,
        reputationSummary: null,
        created_at: new Date(),
        updated_at: new Date(),
        user: undefined as any,
        ...overrides,
    } as P2pCourierProfile;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CourierService', () => {
    let service: CourierService;

    let courierProfileRepo: {
        findOne: jest.Mock;
        create: jest.Mock;
        save: jest.Mock;
        update: jest.Mock;
        find: jest.Mock;
    };
    let reviewRepo: {
        find: jest.Mock;
    };
    let routeRepo: {
        createQueryBuilder: jest.Mock;
    };

    beforeEach(async () => {
        courierProfileRepo = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
        };

        reviewRepo = {
            find: jest.fn().mockResolvedValue([]),
        };

        routeRepo = {
            createQueryBuilder: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([]),
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CourierService,
                { provide: getRepositoryToken(P2pCourierProfile), useValue: courierProfileRepo },
                { provide: getRepositoryToken(P2pReview), useValue: reviewRepo },
                { provide: getRepositoryToken(P2pRoute), useValue: routeRepo },
            ],
        }).compile();

        service = module.get<CourierService>(CourierService);
    });

    // ── applyAsCourier ─────────────────────────────────────────────────────

    describe('applyAsCourier', () => {
        it('creates a courier profile in DRAFT state', async () => {
            const userId = 'user-42';
            const dto = { serviceRadiusKm: 30 };

            const built = makeSavedProfile({ user_id: userId, verificationState: CourierVerificationState.DRAFT });
            const saved = { ...built };

            courierProfileRepo.findOne.mockResolvedValue(null); // no existing profile
            courierProfileRepo.create.mockReturnValue(built);
            courierProfileRepo.save.mockResolvedValue(saved);

            const result = await service.applyAsCourier(userId, dto);

            expect(courierProfileRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: userId,
                    verificationState: CourierVerificationState.DRAFT,
                }),
            );
            expect(result.verificationState).toBe(CourierVerificationState.DRAFT);
            expect(result.isActive).toBe(false);
            expect(result.payoutReady).toBe(false);
        });

        it('throws ConflictException when applying twice for the same user', async () => {
            const userId = 'user-42';
            const existingProfile = makeSavedProfile({ user_id: userId });

            courierProfileRepo.findOne.mockResolvedValue(existingProfile);

            await expect(service.applyAsCourier(userId, {})).rejects.toThrow(ConflictException);
            expect(courierProfileRepo.create).not.toHaveBeenCalled();
        });
    });

    // ── setAvailability ────────────────────────────────────────────────────

    describe('setAvailability', () => {
        it('sets isActive to true and state to ACTIVE when profile is APPROVED', async () => {
            const userId = 'user-42';
            const profile = makeSavedProfile({
                user_id: userId,
                verificationState: CourierVerificationState.APPROVED,
            });
            const updated = {
                ...profile,
                isActive: true,
                verificationState: CourierVerificationState.ACTIVE,
            };

            courierProfileRepo.findOne.mockResolvedValue(profile);
            courierProfileRepo.save.mockResolvedValue(updated);

            const result = await service.setAvailability(userId, true);

            expect(result.isActive).toBe(true);
            expect(result.verificationState).toBe(CourierVerificationState.ACTIVE);
        });

        it('sets isActive to false and state back to APPROVED when currently ACTIVE', async () => {
            const userId = 'user-42';
            const profile = makeSavedProfile({
                user_id: userId,
                verificationState: CourierVerificationState.ACTIVE,
                isActive: true,
            });
            const updated = {
                ...profile,
                isActive: false,
                verificationState: CourierVerificationState.APPROVED,
            };

            courierProfileRepo.findOne.mockResolvedValue(profile);
            courierProfileRepo.save.mockResolvedValue(updated);

            const result = await service.setAvailability(userId, false);

            expect(result.isActive).toBe(false);
            expect(result.verificationState).toBe(CourierVerificationState.APPROVED);
        });

        it('throws BadRequestException when courier state is DRAFT (not yet approved)', async () => {
            const userId = 'user-42';
            const profile = makeSavedProfile({
                user_id: userId,
                verificationState: CourierVerificationState.DRAFT,
            });

            courierProfileRepo.findOne.mockResolvedValue(profile);

            await expect(service.setAvailability(userId, true)).rejects.toThrow(BadRequestException);
            await expect(service.setAvailability(userId, true)).rejects.toThrow(/APPROVED/);
        });

        it('throws BadRequestException when courier state is SUBMITTED', async () => {
            const userId = 'user-42';
            const profile = makeSavedProfile({
                user_id: userId,
                verificationState: CourierVerificationState.SUBMITTED,
            });

            courierProfileRepo.findOne.mockResolvedValue(profile);

            await expect(service.setAvailability(userId, true)).rejects.toThrow(BadRequestException);
        });

        it('throws BadRequestException when courier state is REJECTED', async () => {
            const userId = 'user-42';
            const profile = makeSavedProfile({
                user_id: userId,
                verificationState: CourierVerificationState.REJECTED,
            });

            courierProfileRepo.findOne.mockResolvedValue(profile);

            await expect(service.setAvailability(userId, true)).rejects.toThrow(BadRequestException);
        });

        it('throws NotFoundException when courier profile does not exist', async () => {
            courierProfileRepo.findOne.mockResolvedValue(null);

            await expect(service.setAvailability('unknown-user', true)).rejects.toThrow(NotFoundException);
        });
    });

    // ── getMyProfile ───────────────────────────────────────────────────────

    describe('getMyProfile', () => {
        it('throws NotFoundException when no profile exists for the user', async () => {
            courierProfileRepo.findOne.mockResolvedValue(null);

            await expect(service.getMyProfile('ghost-user')).rejects.toThrow(NotFoundException);
        });
    });
});
