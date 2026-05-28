import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { P2pCourierProfile } from './p2p-courier-profile.entity';
import { RouteStatus, ItemCategory } from '../enums';

@Entity('p2p_routes')
export class P2pRoute {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => P2pCourierProfile, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'courier_profile_id' })
    courierProfile: P2pCourierProfile;

    @Column()
    courier_profile_id: string;

    @Column()
    destinationCountry: string;

    @Column()
    destinationCity: string;

    @Column({ type: 'date' })
    departureDate: Date;

    @Column({ type: 'date', nullable: true })
    returnDate: Date | null;

    @Column({ type: 'text' })
    pickupOrigin: string;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    pickupLatitude: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    pickupLongitude: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    currentLatitude: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    currentLongitude: number | null;

    @Column({ type: 'decimal', precision: 6, scale: 2 })
    capacityKg: number;

    @Column({ type: 'json', nullable: true })
    acceptedItemCategories: ItemCategory[] | null;

    @Column({ type: 'text', nullable: true })
    routeNotes: string | null;

    @Column({
        type: 'enum',
        enum: RouteStatus,
        default: RouteStatus.DRAFT,
    })
    status: RouteStatus;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
