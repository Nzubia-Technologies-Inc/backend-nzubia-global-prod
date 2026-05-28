/**
 * P2P Mappers — Contract Tests
 *
 * These tests freeze the snake_case JSON shape that all P2P controllers emit
 * to the Flutter client. Any change here will be a visible breaking change to
 * the mobile app — keep this file in sync with the Flutter `fromJson` parsers.
 */

import {
    mapCourierProfile,
    mapCourierStatus,
    mapReputation,
    mapRoute,
    mapRouteFeedItem,
    mapShipmentRequest,
    mapOffer,
    mapReview,
    mapWaiver,
    mapWaiverPreview,
    mapComplianceRecord,
    mapComplianceStatus,
    mapRules,
} from '../mappers';
import {
    CourierVerificationState,
    ItemCategory,
    OfferStatus,
    RouteStatus,
    ShipmentRequestStatus,
    WaiverStatus,
} from '../enums';

describe('P2P response mappers', () => {
    const now = new Date('2026-05-01T12:00:00.000Z');

    it('mapCourierProfile produces stable snake_case keys', () => {
        const out = mapCourierProfile({
            id: 'cp-1',
            user_id: 'user-1',
            user: { id: 'user-1', email: 'a@b.c' } as any,
            verificationState: CourierVerificationState.ACTIVE,
            rating: 4.5,
            isActive: true,
            homeLatitude: 5.6,
            homeLongitude: -0.18,
            serviceRadiusKm: 50,
            acceptedCategories: [ItemCategory.DOCUMENTS],
            payoutReady: false,
            reputationSummary: 'Reliable',
            created_at: now,
            updated_at: now,
        } as any);

        expect(out).toEqual({
            id: 'cp-1',
            user_id: 'user-1',
            user: { id: 'user-1', email: 'a@b.c', full_name: null },
            verification_state: 'ACTIVE',
            rating: 4.5,
            is_active: true,
            home_latitude: 5.6,
            home_longitude: -0.18,
            service_radius_km: 50,
            accepted_categories: ['DOCUMENTS'],
            payout_ready: false,
            reputation_summary: 'Reliable',
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
        });
    });

    it('mapCourierStatus exposes verification_state, is_active, payout_ready', () => {
        expect(
            mapCourierStatus({
                verificationState: CourierVerificationState.APPROVED,
                isActive: false,
                payoutReady: true,
            }),
        ).toEqual({
            verification_state: 'APPROVED',
            is_active: false,
            payout_ready: true,
        });
    });

    it('mapReputation embeds review array via mapReview', () => {
        const out = mapReputation({
            averageRating: 4.7,
            reviewCount: 2,
            recentReviews: [
                {
                    id: 'r1',
                    reviewerUserId: 'u1',
                    reviewedUserId: 'u2',
                    shipmentRequestId: 's1',
                    rating: 5,
                    comment: 'Great',
                    trustFlags: null,
                    created_at: now,
                } as any,
            ],
        });

        expect(out.average_rating).toBe(4.7);
        expect(out.review_count).toBe(2);
        expect(out.recent_reviews).toHaveLength(1);
        expect(out.recent_reviews[0].reviewer_user_id).toBe('u1');
        expect(out.recent_reviews[0].reviewed_user_id).toBe('u2');
    });

    it('mapRoute returns snake_case and serialises dates', () => {
        const out = mapRoute({
            id: 'r1',
            courier_profile_id: 'cp-1',
            courierProfile: null,
            destinationCountry: 'US',
            destinationCity: 'New York',
            departureDate: now,
            returnDate: null,
            pickupOrigin: 'Accra',
            pickupLatitude: 5.6,
            pickupLongitude: -0.18,
            currentLatitude: null,
            currentLongitude: null,
            capacityKg: 10,
            acceptedItemCategories: null,
            routeNotes: null,
            status: RouteStatus.PUBLISHED,
            created_at: now,
            updated_at: now,
        } as any);

        expect(out.destination_country).toBe('US');
        expect(out.destination_city).toBe('New York');
        expect(out.departure_date).toBe(now.toISOString());
        expect(out.pickup_origin).toBe('Accra');
        expect(out.capacity_kg).toBe(10);
        expect(out.status).toBe('PUBLISHED');
    });

    it('mapRouteFeedItem wraps route with score number', () => {
        const out = mapRouteFeedItem({
            route: {
                id: 'r1',
                courier_profile_id: 'cp-1',
                courierProfile: null,
                destinationCountry: 'US',
                destinationCity: 'NYC',
                departureDate: now,
                returnDate: null,
                pickupOrigin: 'Accra',
                pickupLatitude: null,
                pickupLongitude: null,
                currentLatitude: null,
                currentLongitude: null,
                capacityKg: 5,
                acceptedItemCategories: null,
                routeNotes: null,
                status: RouteStatus.PUBLISHED,
                created_at: now,
                updated_at: now,
            } as any,
            score: 0.83,
        });

        expect(out.score).toBe(0.83);
        expect(out.route.id).toBe('r1');
    });

    it('mapShipmentRequest exposes all seeker/origin/destination fields', () => {
        const out = mapShipmentRequest({
            id: 's1',
            seeker_user_id: 'user-1',
            seeker: { id: 'user-1', email: 'a@b.c' } as any,
            originAddress: '22 Market St',
            originLatitude: 5.5,
            originLongitude: -0.2,
            destinationCountry: 'US',
            destinationCity: 'New York',
            itemCategory: ItemCategory.CLOTHING,
            itemDescription: 'A coat',
            dimensionsCm: { length: 10, width: 5, height: 3 },
            weightKg: 2,
            declaredValueUsd: 120,
            photoUrls: null,
            status: ShipmentRequestStatus.OPEN,
            matchMetadata: null,
            chatThreadId: null,
            created_at: now,
            updated_at: now,
        } as any);

        expect(out.seeker_user_id).toBe('user-1');
        expect(out.origin_address).toBe('22 Market St');
        expect(out.destination_country).toBe('US');
        expect(out.item_category).toBe('CLOTHING');
        expect(out.weight_kg).toBe(2);
        expect(out.declared_value_usd).toBe(120);
        expect(out.dimensions_cm).toEqual({ length: 10, width: 5, height: 3 });
        expect(out.status).toBe('OPEN');
    });

    it('mapOffer exposes amount and timestamps', () => {
        const out = mapOffer({
            id: 'o1',
            shipment_request_id: 's1',
            route_id: 'r1',
            route: null,
            offerAmountUsd: 45,
            status: OfferStatus.PROPOSED,
            acceptedAt: null,
            rejectedAt: null,
            expiresAt: null,
            paymentReference: null,
            paymentStatus: null,
            created_at: now,
            updated_at: now,
        } as any);

        expect(out.shipment_request_id).toBe('s1');
        expect(out.route_id).toBe('r1');
        expect(out.offer_amount_usd).toBe(45);
        expect(out.status).toBe('PROPOSED');
    });

    it('mapWaiver and mapWaiverPreview produce expected fields', () => {
        const waiver = mapWaiver({
            id: 'w1',
            shipment_request_id: 's1',
            signedByUserId: 'u1',
            termsVersion: 'v1',
            acknowledgedFlags: ['NO_PROHIBITED_ITEMS'],
            proofMetadata: null,
            status: WaiverStatus.ACCEPTED,
            created_at: now,
            updated_at: now,
        } as any);

        expect(waiver.signed_by_user_id).toBe('u1');
        expect(waiver.terms_version).toBe('v1');
        expect(waiver.acknowledged_flags).toEqual(['NO_PROHIBITED_ITEMS']);
        expect(waiver.status).toBe('ACCEPTED');

        const preview = mapWaiverPreview({
            shipmentId: 's1',
            termsVersion: 'v1',
            waiverText: 'I accept...',
            acknowledgeFlags: ['NO_PROHIBITED_ITEMS'],
        });

        expect(preview.shipment_id).toBe('s1');
        expect(preview.waiver_text).toBe('I accept...');
        expect(preview.acknowledge_flags).toContain('NO_PROHIBITED_ITEMS');
    });

    it('mapComplianceStatus and mapRules flatten to snake_case', () => {
        const status = mapComplianceStatus({ record: null, waiverStatus: 'ACCEPTED' });
        expect(status.record).toBeNull();
        expect(status.waiver_status).toBe('ACCEPTED');

        const rules = mapRules({
            platformFeePercent: 5,
            defaultRadiusKm: 25,
            waiverVersion: 'v1',
            maxWeightKg: 30,
            maxDeclaredValueUsd: 5000,
            restrictedCategories: ['MEDICINE'],
        });
        expect(rules.platform_fee_percent).toBe(5);
        expect(rules.default_radius_km).toBe(25);
        expect(rules.max_weight_kg).toBe(30);
        expect(rules.max_declared_value_usd).toBe(5000);
        expect(rules.restricted_categories).toEqual(['MEDICINE']);
    });

    it('mapComplianceRecord handles all flags', () => {
        const out = mapComplianceRecord({
            id: 'cr1',
            shipment_request_id: 's1',
            prohibitedItemDetected: true,
            restrictedCategoryFlags: ['WEAPONS'],
            manualReviewRequired: true,
            rejectionReason: 'Flagged terms',
            reviewedAt: null,
            created_at: now,
        } as any);

        expect(out.prohibited_item_detected).toBe(true);
        expect(out.restricted_category_flags).toEqual(['WEAPONS']);
        expect(out.manual_review_required).toBe(true);
        expect(out.rejection_reason).toBe('Flagged terms');
    });

    it('mapReview produces snake_case fields', () => {
        const out = mapReview({
            id: 'r1',
            reviewerUserId: 'u1',
            reviewedUserId: 'u2',
            shipmentRequestId: 's1',
            rating: 5,
            comment: 'Great',
            trustFlags: { onTime: true },
            created_at: now,
        } as any);

        expect(out.reviewer_user_id).toBe('u1');
        expect(out.reviewed_user_id).toBe('u2');
        expect(out.shipment_request_id).toBe('s1');
        expect(out.trust_flags).toEqual({ onTime: true });
    });
});
