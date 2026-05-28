import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendCourierRequestDto {
    @ApiProperty({ description: 'ID of the courier route to send this request to' })
    @IsUUID()
    routeId: string;

    @ApiPropertyOptional({ description: 'Optional message to the courier' })
    @IsOptional()
    @IsString()
    message?: string;
}
