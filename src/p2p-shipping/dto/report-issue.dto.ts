import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReportIssueDto {
    @ApiProperty()
    @IsString()
    description: string;

    @ApiPropertyOptional({ isArray: true, type: String })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    restrictedCategoryFlags?: string[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    prohibitedItemDetected?: boolean;
}
