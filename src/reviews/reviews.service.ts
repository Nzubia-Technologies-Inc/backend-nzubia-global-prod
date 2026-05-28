import { Injectable } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepo: Repository<Review>,
  ) { }

  async create(createReviewDto: CreateReviewDto, user: any) {
    const review = this.reviewRepo.create({
      rating: createReviewDto.rating,
      comment: createReviewDto.comment,
      customer: { id: user.sub || user.id } as User,
      agent: { id: createReviewDto.agentId } as User,
      shipment: { id: createReviewDto.shipmentId } as any, // Cast to avoid full partial requirement
    });
    return this.reviewRepo.save(review);
  }

  async findAll(agentId?: string) {
    const query = this.reviewRepo.createQueryBuilder('review')
      .leftJoinAndSelect('review.customer', 'customer');

    if (agentId) {
      query.where('review.agent_id = :agentId', { agentId });
    }

    return query.getMany();
  }

  async findOne(id: string) {
    return this.reviewRepo.findOneBy({ id });
  }

  update(id: number, updateReviewDto: UpdateReviewDto) {
    return `This action updates a #${id} review`;
  }

  remove(id: number) {
    return `This action removes a #${id} review`;
  }
}
