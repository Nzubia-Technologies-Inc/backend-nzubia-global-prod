import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ShipmentRequestStatus } from '../enums';

export class UpdateShipmentStatusDto {
    @ApiProperty({ enum: ShipmentRequestStatus })
    @IsEnum(ShipmentRequestStatus)
    status: ShipmentRequestStatus;
}
