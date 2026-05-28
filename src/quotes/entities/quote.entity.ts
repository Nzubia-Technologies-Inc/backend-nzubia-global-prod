import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    JoinColumn,
} from 'typeorm';
import { Shipment } from '../../shipments/entities/shipment.entity';
import { User } from '../../users/entities/user.entity';

@Entity('quotes')
export class Quote {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Shipment, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'shipment_id' })
    shipment: Shipment;

    @Column()
    shipment_id: string;

    @ManyToOne(() => User) // Agent
    @JoinColumn({ name: 'agent_id' })
    agent: User;

    @Column()
    agent_id: string;

    @Column('decimal', { precision: 10, scale: 2 })
    amount: number;

    @Column({ default: 'USD' })
    currency: string;

    @Column('decimal', { precision: 10, scale: 2, default: 0 })
    platform_fee: number;

    @Column({ default: false })
    is_accepted: boolean;

    @Column({ type: 'json' })
    breakdown: {
        base_charge: number;
        customs_fee: number;
        insurance_fee: number;
        platform_fee: number;
        total: number;
    };

    @Column({ nullable: true })
    estimated_delivery_date: Date;


    @Column({ type: 'text', nullable: true })
    notes: string; // Agent notes/terms

    @CreateDateColumn()
    created_at: Date;
}
