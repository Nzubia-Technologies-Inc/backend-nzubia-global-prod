import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptCourierRequestDto {
    @ApiPropertyOptional({ description: 'Price the courier is charging in USD (optional)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    offerAmountUsd?: number;

    @ApiPropertyOptional({ description: 'Optional message to the seeker on acceptance' })
    @IsOptional()
    @IsString()
    message?: string;
}

export class DeclineCourierRequestDto {
    @ApiPropertyOptional({ description: 'Optional reason for declining' })
    @IsOptional()
    @IsString()
    reason?: string;
}
