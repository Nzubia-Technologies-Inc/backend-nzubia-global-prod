import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { P2pReview } from './entities/p2p-review.entity';
import { P2pCourierProfile } from './entities/p2p-courier-profile.entity';
import { CreateReviewDto } from './dto/create-review.dto';

export interface ReviewFilters {
    reviewedUserId?: string;
    reviewerUserId?: string;
    shipmentRequestId?: string;
    minRating?: number;
}

@Injectable()
export class ReviewService {
    constructor(
        @InjectRepository(P2pReview)
        private reviewRepo: Repository<P2pReview>,

        @InjectRepository(P2pCourierProfile)
        private courierProfileRepo: Repository<P2pCourierProfile>,
    ) { }

    async createReview(reviewerId: string, dto: CreateReviewDto): Promise<P2pReview> {
        const review = this.reviewRepo.create({
            reviewerUserId: reviewerId,
            reviewedUserId: dto.reviewedUserId,
            shipmentRequestId: dto.shipmentRequestId,
            rating: dto.rating,
            comment: dto.comment ?? null,
            trustFlags: dto.trustFlags ?? null,
        });

        const saved = await this.reviewRepo.save(review);

        // Refresh courier profile rating
        await this.recalculateCourierRating(dto.reviewedUserId);

        return saved;
    }

    async listReviews(filters: ReviewFilters): Promise<P2pReview[]> {
        const qb = this.reviewRepo.createQueryBuilder('review').orderBy('review.created_at', 'DESC');

        if (filters.reviewedUserId) {
            qb.andWhere('review.reviewedUserId = :rid', { rid: filters.reviewedUserId });
        }
        if (filters.reviewerUserId) {
            qb.andWhere('review.reviewerUserId = :reviewer', { reviewer: filters.reviewerUserId });
        }
        if (filters.shipmentRequestId) {
            qb.andWhere('review.shipmentRequestId = :sid', { sid: filters.shipmentRequestId });
        }
        if (filters.minRating) {
            qb.andWhere('review.rating >= :min', { min: filters.minRating });
        }

        return qb.getMany();
    }

    async getCourierReviews(courierId: string): Promise<P2pReview[]> {
        const profile = await this.courierProfileRepo.findOne({ where: { id: courierId } });
        if (!profile) throw new NotFoundException('Courier profile not found.');

        return this.reviewRepo.find({
            where: { reviewedUserId: profile.user_id },
            order: { created_at: 'DESC' },
        });
    }

    private async recalculateCourierRating(userId: string): Promise<void> {
        const profile = await this.courierProfileRepo.findOne({ where: { user_id: userId } });
        if (!profile) return;

        const reviews = await this.reviewRepo.find({ where: { reviewedUserId: userId } });
        if (reviews.length === 0) return;

        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        await this.courierProfileRepo.update(profile.id, {
            rating: Math.round(avg * 100) / 100,
        });
    }
}
