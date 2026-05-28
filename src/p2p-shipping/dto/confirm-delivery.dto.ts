import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class ConfirmDeliveryDto {
    @ApiPropertyOptional({
        isArray: true,
        type: String,
        description: 'Photo URLs as proof of delivery (e.g. item at destination door)',
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    proofOfDeliveryUrls?: string[];
}
