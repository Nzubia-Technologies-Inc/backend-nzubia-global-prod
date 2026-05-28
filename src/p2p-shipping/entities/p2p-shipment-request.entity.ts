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
import { ShipmentRequestStatus, ItemCategory } from '../enums';

@Entity('p2p_shipment_requests')
export class P2pShipmentRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'seeker_user_id' })
    seeker: User;

    @Column()
    seeker_user_id: string;

    @Column({ type: 'text' })
    originAddress: string;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    originLatitude: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    originLongitude: number | null;

    @Column()
    destinationCountry: string;

    @Column()
    destinationCity: string;

    @Column({
        type: 'enum',
        enum: ItemCategory,
    })
    itemCategory: ItemCategory;

    @Column({ type: 'text' })
    itemDescription: string;

    @Column({ type: 'json', nullable: true })
    dimensionsCm: {
        length: number;
        width: number;
        height: number;
    } | null;

    @Column({ type: 'decimal', precision: 6, scale: 2 })
    weightKg: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    declaredValueUsd: number;

    @Column({ type: 'json', nullable: true })
    photoUrls: string[] | null;

    @Column({
        type: 'enum',
        enum: ShipmentRequestStatus,
        default: ShipmentRequestStatus.DRAFT,
    })
    status: ShipmentRequestStatus;

    @Column({ type: 'json', nullable: true })
    matchMetadata: Record<string, any> | null;

    /** Room ID of the messaging thread created at HANDOFF_PENDING. */
    @Column({ type: 'varchar', length: 255, nullable: true })
    chatThreadId: string | null;

    /** 6-digit PIN generated at HANDOFF_PENDING; seeker shares with courier verbally. */
    @Column({ type: 'varchar', length: 10, nullable: true })
    pickupConfirmationCode: string | null;

    /** Photo URLs uploaded by courier when marking as delivered. */
    @Column({ type: 'json', nullable: true })
    proofOfDeliveryUrls: string[] | null;

    @Column({ type: 'timestamp', nullable: true })
    deliveredAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    completedAt: Date | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
