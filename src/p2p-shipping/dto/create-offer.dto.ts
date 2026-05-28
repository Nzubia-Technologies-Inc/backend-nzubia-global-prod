import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateOfferDto {
    @ApiProperty({ description: 'Route ID this offer is tied to' })
    @IsUUID()
    routeId: string;

    @ApiPropertyOptional({ description: 'Proposed price in USD. If omitted the seeker negotiates.' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    offerAmountUsd?: number;

    @ApiPropertyOptional({ description: 'ISO 8601 datetime when offer expires' })
    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}
