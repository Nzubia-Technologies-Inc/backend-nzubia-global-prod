import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ShipmentStatus {
    REQUESTED = 'REQUESTED',
    QUOTED = 'QUOTED',
    BOOKED = 'BOOKED',
    PICKED_UP = 'PICKED_UP',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED',
}

@Entity('shipments')
export class Shipment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { eager: true })
    @JoinColumn({ name: 'customer_id' })
    customer: User;

    @Column()
    customer_id: string;

    @Column({ type: 'json' })
    origin: {
        address: string;
        lat?: number;
        lng?: number;
        country?: string;
    };

    @Column()
    destination_country: string;

    @Column({ type: 'json', nullable: true })
    destination_meta: {
        address: string;
        lat?: number;
        lng?: number;
    };

    @Column({
        type: 'enum',
        enum: ShipmentStatus,
        default: ShipmentStatus.REQUESTED,
    })
    status: ShipmentStatus;

    @Column({ type: 'json' })
    cargo_meta: {
        description: string;
        weight: number; // kg
        dimensions?: { length: number; width: number; height: number; unit: string };
        images?: string[];
        is_hazardous?: boolean;
        service_type: 'AIR' | 'SEA' | 'LAND';
    };

    @Column({
        type: 'enum',
        enum: ['EXPRESS', 'STANDARD', 'ECONOMY'],
        nullable: true,
    })
    service_level: 'EXPRESS' | 'STANDARD' | 'ECONOMY';

    @Column({ type: 'json', nullable: true })
    additional_services: {
        insurance: boolean;
        customs_clearance: boolean;
        packaging: boolean;
        warehousing: boolean;
        white_glove: boolean;
    };


    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
