import { PartialType } from '@nestjs/swagger';
import { CreateShipmentDto } from './create-shipment.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ShipmentStatus } from '../entities/shipment.entity';

export class UpdateShipmentDto extends PartialType(CreateShipmentDto) {
    @ApiProperty({ enum: ShipmentStatus, required: false })
    @IsOptional()
    @IsEnum(ShipmentStatus)
    status?: ShipmentStatus;
}
