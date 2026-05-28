import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { P2pShipmentRequest } from './p2p-shipment-request.entity';
import { P2pRoute } from './p2p-route.entity';
import { User } from '../../users/entities/user.entity';
import { CourierRequestStatus } from '../enums';

@Entity('p2p_courier_requests')
export class P2pCourierRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => P2pShipmentRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'shipment_request_id' })
    shipmentRequest: P2pShipmentRequest;

    @Column()
    shipment_request_id: string;

    @ManyToOne(() => P2pRoute, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'route_id' })
    route: P2pRoute;

    @Column()
    route_id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'seeker_user_id' })
    seeker: User;

    @Column()
    seeker_user_id: string;

    /** Optional note from the seeker to the courier. */
    @Column({ type: 'text', nullable: true })
    message: string | null;

    @Column({
        type: 'enum',
        enum: CourierRequestStatus,
        default: CourierRequestStatus.PENDING,
    })
    status: CourierRequestStatus;

    /** Reason provided when courier declines. */
    @Column({ type: 'text', nullable: true })
    declineReason: string | null;

    @Column({ type: 'timestamp', nullable: true })
    respondedAt: Date | null;

    /** Auto-expire deadline set at creation. */
    @Column({ type: 'timestamp', nullable: true })
    expiresAt: Date | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
