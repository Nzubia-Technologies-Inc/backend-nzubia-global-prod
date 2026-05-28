import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { Shipment } from '../../shipments/entities/shipment.entity';
import { User } from '../../users/entities/user.entity';

export enum DocumentType {
    // KYC
    BUSINESS_LICENSE = 'BUSINESS_LICENSE',
    INSURANCE_CERT = 'INSURANCE_CERT',
    TAX_ID = 'TAX_ID',

    // Shipment
    INVOICE = 'INVOICE',
    PACKING_LIST = 'PACKING_LIST',
    BILL_OF_LADING = 'BILL_OF_LADING',
    PROOF_OF_PICKUP = 'PROOF_OF_PICKUP',
    PROOF_OF_DELIVERY = 'PROOF_OF_DELIVERY',
    OTHER = 'OTHER',
}

export enum DocumentStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

@Entity('documents')
export class Document {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'enum', enum: DocumentType })
    type: DocumentType;

    @Column()
    url: string;

    @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.PENDING })
    status: DocumentStatus;

    // Polymorphic-ish relationships (Nullable FKs)

    @ManyToOne(() => Shipment, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'shipment_id' })
    shipment: Shipment;

    @Column({ nullable: true })
    shipment_id: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User; // For Agent KYC or User specific docs

    @Column({ nullable: true })
    user_id: string;

    @CreateDateColumn()
    created_at: Date;
}
