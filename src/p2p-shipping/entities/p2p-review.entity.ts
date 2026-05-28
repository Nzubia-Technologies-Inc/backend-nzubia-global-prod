import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('p2p_reviews')
export class P2pReview {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    reviewerUserId: string;

    @Column()
    reviewedUserId: string;

    @Column()
    shipmentRequestId: string;

    @Column({ type: 'int' })
    rating: number; // 1-5

    @Column({ type: 'text', nullable: true })
    comment: string | null;

    @Column({ type: 'json', nullable: true })
    trustFlags: Record<string, any> | null;

    @CreateDateColumn()
    created_at: Date;
}
