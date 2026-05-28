import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class AcceptWaiverDto {
    @ApiProperty({
        isArray: true,
        type: String,
        description: 'List of flag keys the user explicitly acknowledged',
    })
    @IsArray()
    @IsString({ each: true })
    acknowledgedFlags: string[];

    @ApiPropertyOptional({ description: 'Optional proof metadata (e.g. signature timestamp)' })
    @IsOptional()
    proofMetadata?: Record<string, any>;
}
