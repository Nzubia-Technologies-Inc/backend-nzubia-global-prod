import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CourierVerificationState, ItemCategory } from '../enums';

@Entity('p2p_courier_profiles')
export class P2pCourierProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column()
    user_id: string;

    @Column({
        type: 'enum',
        enum: CourierVerificationState,
        default: CourierVerificationState.DRAFT,
    })
    verificationState: CourierVerificationState;

    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.00 })
    rating: number;

    @Column({ default: false })
    isActive: boolean;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    homeLatitude: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    homeLongitude: number | null;

    @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
    serviceRadiusKm: number | null;

    @Column({ type: 'json', nullable: true })
    acceptedCategories: ItemCategory[] | null;

    @Column({ default: false })
    payoutReady: boolean;

    @Column({ type: 'text', nullable: true })
    reputationSummary: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
