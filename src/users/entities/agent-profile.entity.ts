import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('agent_profiles')
export class AgentProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    company_name: string;

    @Column({ nullable: true })
    business_reg_number: string; // Providing flexibility if license_number is different

    @Column({ nullable: true })
    license_number: string;

    @Column({ type: 'json', nullable: true })
    service_regions: string[]; // Array of country codes/names

    @Column({ type: 'json', nullable: true })
    cargo_specializations: string[]; // e.g. ["HAZMAT", "PERISHABLE", "VEHICLES"]

    @Column({ nullable: true })
    insurance_certificate_url: string;

    @Column({ nullable: true })
    years_in_business: number;

    @Column({ nullable: true })
    fleet_size: number;

    @Column({ type: 'json', nullable: true })
    warehouse_locations: Array<{
        address: string;
        capacity?: string;
    }>;


    @Column({ nullable: true })
    agent_type: string; // e.g. 'INDIVIDUAL', 'BUSINESS'

    @Column({ nullable: true })
    address: string; // Agent's business address

    @Column({ nullable: true })
    id_type: string; // e.g. 'PASSPORT', 'DRIVER_LICENSE'

    @Column({ nullable: true })
    id_number: string;

    @Column({ nullable: true })
    id_document_url: string;

    @Column({ nullable: true })
    selfie_url: string;

    @Column({ nullable: true })
    service_radius_km: number;

    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0, nullable: true })
    rating: number;

    @Column({ default: 0, nullable: true })
    rating_count: number;

    @Column({ default: 0, nullable: true })
    orders_fulfilled: number;

    @Column({ nullable: true })
    preferred_payout_method: string; // e.g. 'STRIPE', 'ZELLE'

    @Column({ nullable: true })
    zelle_email: string;

    @Column({ nullable: true })
    zelle_phone: string;

    @Column({ nullable: true })
    stripe_connect_id: string;

    @OneToOne(() => User, (user) => user.agentProfile, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column()
    user_id: string; // Explicit FK column

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
