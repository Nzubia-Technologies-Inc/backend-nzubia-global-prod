import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateReviewDto {
    @ApiProperty()
    @IsUUID()
    reviewedUserId: string;

    @ApiProperty()
    @IsUUID()
    shipmentRequestId: string;

    @ApiProperty({ minimum: 1, maximum: 5 })
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    comment?: string;

    @ApiPropertyOptional({ description: 'Key/value trust flag annotations' })
    @IsOptional()
    trustFlags?: Record<string, any>;
}
