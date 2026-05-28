import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { mapReview } from './mappers';

@ApiTags('P2P Shipping')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('p2p/reviews')
export class ReviewController {
    constructor(private readonly reviewService: ReviewService) { }

    @Post()
    @ApiOperation({ summary: 'Submit a review for a completed P2P shipment' })
    async createReview(@Body() dto: CreateReviewDto, @Request() req) {
        const review = await this.reviewService.createReview(req.user.id, dto);
        return mapReview(review);
    }

    @Get()
    @ApiOperation({ summary: 'List reviews with optional filters' })
    @ApiQuery({ name: 'reviewedUserId', required: false })
    @ApiQuery({ name: 'reviewerUserId', required: false })
    @ApiQuery({ name: 'shipmentRequestId', required: false })
    @ApiQuery({ name: 'minRating', required: false, type: Number })
    async listReviews(
        @Query('reviewedUserId') reviewedUserId?: string,
        @Query('reviewerUserId') reviewerUserId?: string,
        @Query('shipmentRequestId') shipmentRequestId?: string,
        @Query('minRating') minRating?: string,
    ) {
        const reviews = await this.reviewService.listReviews({
            reviewedUserId,
            reviewerUserId,
            shipmentRequestId,
            minRating: minRating ? parseInt(minRating, 10) : undefined,
        });
        return reviews.map(mapReview);
    }

    @Get('courier/:courierId')
    @ApiOperation({ summary: 'Get all reviews for a specific courier profile' })
    async getCourierReviews(@Param('courierId') courierId: string) {
        const reviews = await this.reviewService.getCourierReviews(courierId);
        return reviews.map(mapReview);
    }
}
