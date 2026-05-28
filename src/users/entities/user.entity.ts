import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { AgentProfile } from './agent-profile.entity';

export enum UserRole {
    CUSTOMER = 'CUSTOMER',
    AGENT = 'AGENT',
    ADMIN = 'ADMIN',
}

export enum KycStatus {
    PENDING = 'PENDING',
    VERIFIED = 'VERIFIED',
    REJECTED = 'REJECTED',
    NOT_SUBMITTED = 'NOT_SUBMITTED',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column({ type: 'varchar', nullable: true }) // Nullable for initial OAuth flows or if Phone-only
    password_hash: string | null;

    @Column({ type: 'varchar', nullable: true, unique: true })
    phone: string | null;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.CUSTOMER,
    })
    role: UserRole;

    @Column({ type: 'varchar', nullable: true })
    full_name: string | null;

    @Column({ type: 'varchar', nullable: true })
    profile_image_url: string | null;

    @Column({ nullable: true })
    business_name: string; // If B2B

    @Column({ type: 'enum', enum: ['INDIVIDUAL', 'BUSINESS'], nullable: true })
    business_type: 'INDIVIDUAL' | 'BUSINESS';

    @Column({ nullable: true })
    tax_id: string; // EIN or equivalent

    @Column({ type: 'json', nullable: true })
    address: {
        street: string;
        city: string;
        state: string;
        zip: string;
        country: string;
    };


    @Column({
        type: 'enum',
        enum: KycStatus,
        default: KycStatus.NOT_SUBMITTED,
    })
    kyc_status: KycStatus;

    // OTP Fields
    @Column({ type: 'varchar', nullable: true })
    otp_code: string | null;

    @Column({ type: 'timestamp', nullable: true })
    otp_expires_at: Date | null;

    @Column({ default: false })
    is_verified: boolean; // Email/Phone verification status

    @OneToOne(() => AgentProfile, (profile) => profile.user, { cascade: true })
    agentProfile: AgentProfile;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
