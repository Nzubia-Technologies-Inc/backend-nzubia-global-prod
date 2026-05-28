import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsEnum,
    IsNumber,
    IsOptional,
    Max,
    Min,
} from 'class-validator';
import { ItemCategory } from '../enums';

export class CreateCourierProfileDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(-90)
    @Max(90)
    homeLatitude?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(-180)
    @Max(180)
    homeLongitude?: number;

    @ApiPropertyOptional({ default: 50 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(500)
    serviceRadiusKm?: number;

    @ApiPropertyOptional({ enum: ItemCategory, isArray: true })
    @IsOptional()
    @IsArray()
    @IsEnum(ItemCategory, { each: true })
    acceptedCategories?: ItemCategory[];
}
