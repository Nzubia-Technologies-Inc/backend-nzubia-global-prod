import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Shipment } from '../../shipments/entities/shipment.entity';

@Entity('reviews')
export class Review {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'int' })
    rating: number; // 1-5

    @Column({ type: 'text', nullable: true })
    comment: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'customer_id' })
    customer: User;

    @Column()
    customer_id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'agent_id' })
    agent: User;

    @Column()
    agent_id: string;

    @ManyToOne(() => Shipment)
    @JoinColumn({ name: 'shipment_id' })
    shipment: Shipment;

    @Column()
    shipment_id: string;

    @CreateDateColumn()
    created_at: Date;
}
