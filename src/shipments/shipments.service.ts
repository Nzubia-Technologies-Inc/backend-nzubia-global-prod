import { Injectable } from '@nestjs/common';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { EmailService } from '../notifications/email/email.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectRepository(Shipment)
    private shipmentRepo: Repository<Shipment>,
    private emailService: EmailService,
    private paymentsService: PaymentsService,
  ) { }


  async create(createShipmentDto: CreateShipmentDto, user: any) {
    // user param comes from req.user (JWT Payload or Partial User)
    // We can just pass the ID if existing user.
    const shipment = this.shipmentRepo.create({
      ...createShipmentDto,
      customer: { id: user.sub || user.id } as User, // Cast to User partial for FK
      status: ShipmentStatus.REQUESTED,
    });
    return this.shipmentRepo.save(shipment);
  }

  async findAll(status?: ShipmentStatus) {
    // For agents/admin: filtering by status
    const query = this.shipmentRepo.createQueryBuilder('shipment')
      .leftJoinAndSelect('shipment.customer', 'customer');

    if (status) {
      query.where('shipment.status = :status', { status });
    }

    return query.getMany();
  }

  async findOne(id: string) {
    return this.shipmentRepo.findOne({ where: { id }, relations: ['customer'] });
  }

  async update(id: string, updateShipmentDto: UpdateShipmentDto) {
    const shipment = await this.findOne(id);
    if (!shipment) throw new Error('Shipment Not Found');

    await this.shipmentRepo.update(id, updateShipmentDto);

    // Notification Trigger
    if (updateShipmentDto.status && updateShipmentDto.status !== shipment.status) {
      // Status changed
      if (shipment.customer?.email) {
        await this.emailService.sendEmail(
          shipment.customer.email,
          `Shipment Update: ${updateShipmentDto.status}`,
          `Your shipment ${id} status has been updated to ${updateShipmentDto.status}.`
        );
      }

      // Payment Release Trigger
      if (updateShipmentDto.status === ShipmentStatus.DELIVERED) {
        await this.paymentsService.releaseFunds(id);
      }
    }

    return this.findOne(id);
  }

  remove(id: number) {
    return `This action removes a #${id} shipment`;
  }
}
