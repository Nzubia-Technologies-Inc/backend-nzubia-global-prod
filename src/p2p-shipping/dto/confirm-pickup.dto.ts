import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Length } from 'class-validator';

export class ConfirmPickupDto {
    @ApiProperty({ description: '6-digit pickup confirmation code shared by the seeker', example: '483921' })
    @IsString()
    @Length(6, 6)
    pickupConfirmationCode: string;

    @ApiPropertyOptional({ isArray: true, type: String, description: 'Optional photo URLs taken at pickup' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    pickupPhotoUrls?: string[];
}
