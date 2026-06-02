/**
 * P2P Shipping — Response Mappers
 *
 * Convert internal entities into the snake_case JSON contract used by the
 * Flutter client. This is the single source of truth for HTTP response shapes:
 * controllers must run every entity returned to the wire through these
 * functions so the contract stays stable independently of TypeORM column
 * casing or future entity refactors.
 */

import { P2pCourierProfile } from './entities/p2p-courier-profile.entity';
import { P2pRoute } from './entities/p2p-route.entity';
import { P2pShipmentRequest } from './entities/p2p-shipment-request.entity';
import { P2pOffer } from './entities/p2p-offer.entity';
import { P2pReview } from './entities/p2p-review.entity';
import { P2pWaiver } from './entities/p2p-waiver.entity';
import { P2pComplianceRecord } from './entities/p2p-compliance-record.entity';
import { P2pCourierRequest } from './entities/p2p-courier-request.entity';
import { User } from '../users/entities/user.entity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoOrNull(v: Date | string | null | undefined): string | null {
    if (!v) return null;
    return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function num(v: number | string | null | undefined): number | null {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

function userSummary(user: User | null | undefined) {
    if (!user) return null;
    return {
        id: user.id,
        email: user.email ?? null,
        full_name: (user as any).full_name ?? null,
    };
}

// ─── Courier ──────────────────────────────────────────────────────────────────

export function mapCourierProfile(p: P2pCourierProfile) {
    return {
        id: p.id,
        user_id: p.user_id,
        user: userSummary(p.user),
        verification_state: p.verificationState,
        rating: num(p.rating) ?? 0,
        is_active: Boolean(p.isActive),
        home_latitude: num(p.homeLatitude),
        home_longitude: num(p.homeLongitude),
        service_radius_km: num(p.serviceRadiusKm),
        accepted_categories: p.acceptedCategories ?? null,
        payout_ready: Boolean(p.payoutReady),
        reputation_summary: p.reputationSummary ?? null,
        created_at: isoOrNull(p.created_at),
        updated_at: isoOrNull(p.updated_at),
    };
}

export function mapCourierStatus(s: {
    verificationState: string;
    isActive: boolean;
    payoutReady: boolean;
}) {
    return {
        verification_state: s.verificationState,
        is_active: Boolean(s.isActive),
        payout_ready: Boolean(s.payoutReady),
    };
}

export function mapReputation(rep: {
    averageRating: number;
    reviewCount: number;
    recentReviews: P2pReview[];
}) {
    return {
        average_rating: rep.averageRating,
        review_count: rep.reviewCount,
        recent_reviews: rep.recentReviews.map(mapReview),
    };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export function mapRoute(r: P2pRoute) {
    return {
        id: r.id,
        courier_profile_id: r.courier_profile_id,
        courier_profile: r.courierProfile ? mapCourierProfile(r.courierProfile) : null,
        destination_country: r.destinationCountry,
        destination_city: r.destinationCity,
        departure_date: isoOrNull(r.departureDate),
        return_date: isoOrNull(r.returnDate),
        pickup_origin: r.pickupOrigin,
        pickup_latitude: num(r.pickupLatitude),
        pickup_longitude: num(r.pickupLongitude),
        current_latitude: num(r.currentLatitude),
        current_longitude: num(r.currentLongitude),
        capacity_kg: num(r.capacityKg) ?? 0,
        accepted_item_categories: r.acceptedItemCategories ?? null,
        route_notes: r.routeNotes ?? null,
        status: r.status,
        created_at: isoOrNull(r.created_at),
        updated_at: isoOrNull(r.updated_at),
    };
}

export function mapRouteFeedItem(item: { route: P2pRoute; score: number }) {
    return {
        route: mapRoute(item.route),
        score: Number(item.score) || 0,
    };
}

// ─── Shipment request ─────────────────────────────────────────────────────────

export function mapShipmentRequest(s: P2pShipmentRequest) {
    return {
        id: s.id,
        seeker_user_id: s.seeker_user_id,
        seeker: userSummary(s.seeker),
        origin_address: s.originAddress,
        origin_latitude: num(s.originLatitude),
        origin_longitude: num(s.originLongitude),
        destination_country: s.destinationCountry,
        destination_city: s.destinationCity,
        item_category: s.itemCategory,
        item_description: s.itemDescription,
        dimensions_cm: s.dimensionsCm ?? null,
        weight_kg: num(s.weightKg) ?? 0,
        declared_value_usd: num(s.declaredValueUsd) ?? 0,
        photo_urls: s.photoUrls ?? null,
        status: s.status,
        match_metadata: s.matchMetadata ?? null,
        chat_thread_id: s.chatThreadId ?? null,
        pickup_confirmation_code: s.pickupConfirmationCode ?? null,
        proof_of_delivery_urls: s.proofOfDeliveryUrls ?? null,
        delivered_at: isoOrNull(s.deliveredAt),
        completed_at: isoOrNull(s.completedAt),
        created_at: isoOrNull(s.created_at),
        updated_at: isoOrNull(s.updated_at),
    };
}

// ─── Offer ────────────────────────────────────────────────────────────────────

export function mapOffer(o: P2pOffer) {
    return {
        id: o.id,
        shipment_request_id: o.shipment_request_id,
        route_id: o.route_id,
        route: o.route ? mapRoute(o.route) : null,
        offer_amount_usd: num(o.offerAmountUsd),
        status: o.status,
        accepted_at: isoOrNull(o.acceptedAt),
        rejected_at: isoOrNull(o.rejectedAt),
        expires_at: isoOrNull(o.expiresAt),
        payment_reference: o.paymentReference ?? null,
        payment_status: o.paymentStatus ?? null,
        created_at: isoOrNull(o.created_at),
        updated_at: isoOrNull(o.updated_at),
    };
}

// ─── Review ───────────────────────────────────────────────────────────────────

export function mapReview(r: P2pReview) {
    return {
        id: r.id,
        reviewer_user_id: r.reviewerUserId,
        reviewed_user_id: r.reviewedUserId,
        shipment_request_id: r.shipmentRequestId,
        rating: r.rating,
        comment: r.comment ?? null,
        trust_flags: r.trustFlags ?? null,
        created_at: isoOrNull(r.created_at),
    };
}

// ─── Waiver ───────────────────────────────────────────────────────────────────

export function mapWaiver(w: P2pWaiver) {
    return {
        id: w.id,
        shipment_request_id: w.shipment_request_id,
        signed_by_user_id: w.signedByUserId,
        terms_version: w.termsVersion,
        acknowledged_flags: w.acknowledgedFlags ?? [],
        proof_metadata: w.proofMetadata ?? null,
        status: w.status,
        created_at: isoOrNull(w.created_at),
        updated_at: isoOrNull(w.updated_at),
    };
}

export function mapWaiverPreview(p: {
    shipmentId: string;
    termsVersion: string;
    waiverText: string;
    acknowledgeFlags: string[];
}) {
    return {
        shipment_id: p.shipmentId,
        terms_version: p.termsVersion,
        waiver_text: p.waiverText,
        acknowledge_flags: p.acknowledgeFlags,
    };
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export function mapComplianceRecord(r: P2pComplianceRecord) {
    return {
        id: r.id,
        shipment_request_id: r.shipment_request_id,
        prohibited_item_detected: Boolean(r.prohibitedItemDetected),
        restricted_category_flags: r.restrictedCategoryFlags ?? null,
        manual_review_required: Boolean(r.manualReviewRequired),
        rejection_reason: r.rejectionReason ?? null,
        reviewed_at: isoOrNull(r.reviewedAt),
        created_at: isoOrNull(r.created_at),
    };
}

// ─── Courier Request ──────────────────────────────────────────────────────────

export function mapCourierRequest(r: P2pCourierRequest) {
    return {
        id: r.id,
        shipment_request_id: r.shipment_request_id,
        route_id: r.route_id,
        route: r.route ? mapRoute(r.route) : null,
        seeker_user_id: r.seeker_user_id,
        seeker: r.seeker ? userSummary(r.seeker) : null,
        message: r.message ?? null,
        status: r.status,
        decline_reason: r.declineReason ?? null,
        responded_at: isoOrNull(r.respondedAt),
        expires_at: isoOrNull(r.expiresAt),
        created_at: isoOrNull(r.created_at),
        updated_at: isoOrNull(r.updated_at),
    };
}

export function mapComplianceStatus(s: {
    record: P2pComplianceRecord | null;
    waiverStatus: string | null;
}) {
    return {
        record: s.record ? mapComplianceRecord(s.record) : null,
        waiver_status: s.waiverStatus ?? null,
    };
}

export function mapRules(rules: {
    platformFeePercent: number;
    defaultRadiusKm: number;
    waiverVersion: string;
    maxWeightKg: number;
    maxDeclaredValueUsd: number;
    restrictedCategories: string[];
}) {
    return {
        platform_fee_percent: rules.platformFeePercent,
        default_radius_km: rules.defaultRadiusKm,
        waiver_version: rules.waiverVersion,
        max_weight_kg: rules.maxWeightKg,
        max_declared_value_usd: rules.maxDeclaredValueUsd,
        restricted_categories: rules.restrictedCategories,
    };
}
