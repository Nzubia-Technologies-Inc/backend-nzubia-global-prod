import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class RaiseDisputeDto {
    @ApiProperty({ description: 'Description of the issue (e.g. item damaged, not delivered, missing)' })
    @IsString()
    reason: string;

    @ApiPropertyOptional({ isArray: true, type: String, description: 'Evidence photo URLs' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    evidenceUrls?: string[];
}
