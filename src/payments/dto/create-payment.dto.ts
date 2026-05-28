import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class CreatePaymentDto {
    @ApiProperty()
    @IsNumber()
    amount: number; // in cents

    @ApiProperty()
    @IsString()
    currency: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    agentId?: string; // Internal User ID of agent (to lookup Connect ID)
}
