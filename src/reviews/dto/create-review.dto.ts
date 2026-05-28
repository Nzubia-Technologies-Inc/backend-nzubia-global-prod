import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Max, Min, IsUUID } from 'class-validator';

export class CreateReviewDto {
    @ApiProperty()
    @IsNumber()
    @Min(1)
    @Max(5)
    rating: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    comment?: string;

    @ApiProperty()
    @IsUUID()
    agentId: string;

    @ApiProperty()
    @IsUUID()
    shipmentId: string;
}
