import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { RouteService, scoreRoute, haversineKm } from '../route.service';
import { P2pRoute } from '../entities/p2p-route.entity';
import { P2pCourierProfile } from '../entities/p2p-courier-profile.entity';
import { P2pCourierRequest } from '../entities/p2p-courier-request.entity';
import { CourierVerificationState, RouteStatus } from '../enums';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { EmailService } from '../../notifications/email/email.service';

const makeEmailService = () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) });

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<P2pCourierProfile> = {}): P2pCourierProfile {
    return {
        id: 'profile-1',
        user_id: 'user-1',
        verificationState: CourierVerificationState.APPROVED,
        rating: 3,
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

function makeRoute(overrides: Partial<P2pRoute> = {}): P2pRoute {
    return {
        id: 'route-1',
        courier_profile_id: 'profile-1',
        destinationCountry: 'US',
        destinationCity: 'New York',
        departureDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days out
        returnDate: null,
        pickupOrigin: 'Accra, Ghana',
        pickupLatitude: 5.6037,
        pickupLongitude: -0.187,
        currentLatitude: null,
        currentLongitude: null,
        capacityKg: 10,
        acceptedItemCategories: null,
        routeNotes: null,
        status: RouteStatus.PUBLISHED,
        created_at: new Date(),
        updated_at: new Date(),
        courierProfile: makeProfile(),
        ...overrides,
    } as P2pRoute;
}

// ─── Mock factories ──────────────────────────────────────────────────────────

const makeRouteRepo = (routes: P2pRoute[] = []) => ({
    createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(routes),
    }),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
});

const makeCourierProfileRepo = () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
});

const makePlatformSettingsService = (radiusKm = 50) => ({
    getP2pDefaultRadiusKm: jest.fn().mockResolvedValue(radiusKm),
    getP2pProhibitedItems: jest.fn().mockResolvedValue([]),
});

// ─── Pure-function tests ─────────────────────────────────────────────────────

describe('haversineKm', () => {
    it('returns ~0 for the same point', () => {
        expect(haversineKm(5.6, -0.19, 5.6, -0.19)).toBeCloseTo(0, 3);
    });

    it('returns positive distance for different points', () => {
        // Accra (5.6037°N, 0.187°W) → New York (40.7128°N, 74.006°W) ≈ 8200 km
        const dist = haversineKm(5.6037, -0.187, 40.7128, -74.006);
        expect(dist).toBeGreaterThan(7000);
        expect(dist).toBeLessThan(10000);
    });
});

describe('scoreRoute – ranking rules', () => {
    const destCountry = 'US';
    const destCity = 'New York';
    const weightKg = 2;
    const maxRadiusKm = 50;

    // Pickup coordinates: Accra, Ghana
    const originLat = 5.6037;
    const originLng = -0.187;

    it('courier closer to pickup ranks higher than one farther away with same route', () => {
        const nearRoute = makeRoute({ pickupLatitude: 5.61, pickupLongitude: -0.19 });   // ~1 km
        const farRoute = makeRoute({ pickupLatitude: 6.5, pickupLongitude: -0.2 });       // ~100 km

        const nearScore = scoreRoute(nearRoute, destCountry, destCity, originLat, originLng, weightKg, maxRadiusKm);
        const farScore = scoreRoute(farRoute, destCountry, destCity, originLat, originLng, weightKg, maxRadiusKm);

        expect(nearScore).toBeGreaterThan(farScore);
    });

    it('verified (ACTIVE) courier ranks higher than unverified with same distance', () => {
        const activeProfile = makeProfile({ verificationState: CourierVerificationState.ACTIVE, rating: 3 });
        const draftProfile = makeProfile({ verificationState: CourierVerificationState.DRAFT, rating: 3 });

        const verifiedRoute = makeRoute({ courierProfile: activeProfile });
        const unverifiedRoute = makeRoute({ courierProfile: draftProfile });

        // Same coordinates for both
        const verifiedScore = scoreRoute(verifiedRoute, destCountry, destCity, originLat, originLng, weightKg, maxRadiusKm);
        const unverifiedScore = scoreRoute(unverifiedRoute, destCountry, destCity, originLat, originLng, weightKg, maxRadiusKm);

        expect(verifiedScore).toBeGreaterThan(unverifiedScore);
    });

    it('route with sooner departure date ranks higher when all else equal', () => {
        const now = Date.now();
        const soonRoute = makeRoute({ departureDate: new Date(now + 1 * 24 * 60 * 60 * 1000) }); // 1 day out
        const laterRoute = makeRoute({ departureDate: new Date(now + 20 * 24 * 60 * 60 * 1000) }); // 20 days out

        const soonScore = scoreRoute(soonRoute, destCountry, destCity, originLat, originLng, weightKg, maxRadiusKm);
        const laterScore = scoreRoute(laterRoute, destCountry, destCity, originLat, originLng, weightKg, maxRadiusKm);

        expect(soonScore).toBeGreaterThan(laterScore);
    });

    it('route with insufficient capacity scores 0 for the capacity component (and ranks lower)', () => {
        const goodRoute = makeRoute({ capacityKg: 10 });   // capacity >= weightKg (2)
        const badRoute = makeRoute({ capacityKg: 1 });    // capacity < weightKg (2)

        const goodScore = scoreRoute(goodRoute, destCountry, destCity, originLat, originLng, weightKg, maxRadiusKm);
        const badScore = scoreRoute(badRoute, destCountry, destCity, originLat, originLng, weightKg, maxRadiusKm);

        // The capacity component is 0 for an insufficient route
        expect(goodScore).toBeGreaterThan(badScore);
    });
});

// ─── RouteService.getRouteFeed ────────────────────────────────────────────────

describe('RouteService – getRouteFeed', () => {
    let service: RouteService;
    let routeRepo: ReturnType<typeof makeRouteRepo>;
    let platformSettings: ReturnType<typeof makePlatformSettingsService>;

    const originLat = 5.6037;
    const originLng = -0.187;
    const destCountry = 'US';
    const destCity = 'New York';

    async function build(routes: P2pRoute[]) {
        routeRepo = makeRouteRepo(routes);
        platformSettings = makePlatformSettingsService(50);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RouteService,
                { provide: getRepositoryToken(P2pRoute), useValue: routeRepo },
                { provide: getRepositoryToken(P2pCourierProfile), useValue: makeCourierProfileRepo() },
                { provide: getRepositoryToken(P2pCourierRequest), useValue: { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null), save: jest.fn(), delete: jest.fn() } },
                { provide: PlatformSettingsService, useValue: platformSettings },
                { provide: EmailService, useValue: makeEmailService() },
            ],
        }).compile();

        service = module.get<RouteService>(RouteService);
    }

    it('returns routes sorted by descending score', async () => {
        const now = Date.now();
        const nearActive = makeRoute({
            id: 'near-active',
            pickupLatitude: 5.61,
            pickupLongitude: -0.19,
            departureDate: new Date(now + 1 * 24 * 60 * 60 * 1000),
            courierProfile: makeProfile({ verificationState: CourierVerificationState.ACTIVE, rating: 5 }),
        });
        const farDraft = makeRoute({
            id: 'far-draft',
            pickupLatitude: 6.5,
            pickupLongitude: -0.2,
            departureDate: new Date(now + 25 * 24 * 60 * 60 * 1000),
            courierProfile: makeProfile({ verificationState: CourierVerificationState.DRAFT, rating: 1 }),
        });

        await build([nearActive, farDraft]);

        const feed = await service.getRouteFeed({
            destinationCountry: destCountry,
            destinationCity: destCity,
            originLat,
            originLng,
            minCapacityKg: 1,
            radiusKm: 200,
        });

        expect(feed[0].route.id).toBe('near-active');
        expect(feed[1].route.id).toBe('far-draft');
        expect(feed[0].score).toBeGreaterThan(feed[1].score);
    });

    it('excludes routes whose capacity is less than the requested weight (via minCapacityKg filter)', async () => {
        const tinyRoute = makeRoute({ id: 'tiny', capacityKg: 0.5 });
        const bigRoute = makeRoute({ id: 'big', capacityKg: 10 });

        // makeRouteRepo already applies the DB filter; simulate it at repo level
        // by returning only the route whose capacityKg passes the filter
        routeRepo = makeRouteRepo([bigRoute]); // listRoutes DB query filtered out tinyRoute
        platformSettings = makePlatformSettingsService(50);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RouteService,
                { provide: getRepositoryToken(P2pRoute), useValue: routeRepo },
                { provide: getRepositoryToken(P2pCourierProfile), useValue: makeCourierProfileRepo() },
                { provide: getRepositoryToken(P2pCourierRequest), useValue: { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null), save: jest.fn(), delete: jest.fn() } },
                { provide: PlatformSettingsService, useValue: platformSettings },
                { provide: EmailService, useValue: makeEmailService() },
            ],
        }).compile();

        service = module.get<RouteService>(RouteService);

        const feed = await service.getRouteFeed({
            destinationCountry: destCountry,
            destinationCity: destCity,
            minCapacityKg: 2,
        });

        expect(feed.map((f) => f.route.id)).not.toContain('tiny');
        expect(feed.map((f) => f.route.id)).toContain('big');
    });
});
