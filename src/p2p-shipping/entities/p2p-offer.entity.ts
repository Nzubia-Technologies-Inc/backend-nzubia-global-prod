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
import { OfferStatus } from '../enums';

@Entity('p2p_offers')
export class P2pOffer {
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

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    offerAmountUsd: number | null;

    @Column({
        type: 'enum',
        enum: OfferStatus,
        default: OfferStatus.PROPOSED,
    })
    status: OfferStatus;

    @Column({ type: 'timestamp', nullable: true })
    acceptedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    rejectedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    expiresAt: Date | null;

    /** Stripe PaymentIntent ID (or PENDING record ID) created at acceptOffer.
     *  Null when offerAmountUsd was not set, or before acceptance. */
    @Column({ type: 'varchar', length: 255, nullable: true })
    paymentReference: string | null;

    /** Human-readable payment hold status stored alongside paymentReference. */
    @Column({ type: 'varchar', length: 50, nullable: true })
    paymentStatus: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
