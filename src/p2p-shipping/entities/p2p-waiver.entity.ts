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
import { User } from '../../users/entities/user.entity';
import { WaiverStatus } from '../enums';

@Entity('p2p_waivers')
export class P2pWaiver {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => P2pShipmentRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'shipment_request_id' })
    shipmentRequest: P2pShipmentRequest;

    @Column()
    shipment_request_id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'signed_by_user_id' })
    user: User;

    @Column({ name: 'signed_by_user_id' })
    signedByUserId: string; // maps to the same DB column as JoinColumn above

    @Column()
    termsVersion: string;

    @Column({ type: 'json' })
    acknowledgedFlags: string[];

    @Column({ type: 'json', nullable: true })
    proofMetadata: Record<string, any> | null;

    @Column({
        type: 'enum',
        enum: WaiverStatus,
        default: WaiverStatus.PENDING,
    })
    status: WaiverStatus;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
