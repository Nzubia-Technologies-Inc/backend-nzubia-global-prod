import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetAvailabilityDto {
    @ApiProperty({ description: 'Set courier availability. Courier must be in APPROVED state.' })
    @IsBoolean()
    isActive: boolean;
}
