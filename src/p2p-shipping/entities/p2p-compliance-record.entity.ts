import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { P2pShipmentRequest } from './p2p-shipment-request.entity';

@Entity('p2p_compliance_records')
export class P2pComplianceRecord {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => P2pShipmentRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'shipment_request_id' })
    shipmentRequest: P2pShipmentRequest;

    @Column()
    shipment_request_id: string;

    @Column({ default: false })
    prohibitedItemDetected: boolean;

    @Column({ type: 'json', nullable: true })
    restrictedCategoryFlags: string[] | null;

    @Column({ default: false })
    manualReviewRequired: boolean;

    @Column({ type: 'text', nullable: true })
    rejectionReason: string | null;

    @Column({ type: 'timestamp', nullable: true })
    reviewedAt: Date | null;

    @CreateDateColumn()
    created_at: Date;
}
