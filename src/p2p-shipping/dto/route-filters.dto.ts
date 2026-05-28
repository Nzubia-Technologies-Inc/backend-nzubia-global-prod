import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ItemCategory } from '../enums';

export class RouteFiltersDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    destinationCountry?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    destinationCity?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Transform(({ value }) => parseFloat(value))
    @IsNumber()
    @Min(-90)
    @Max(90)
    originLat?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @Transform(({ value }) => parseFloat(value))
    @IsNumber()
    @Min(-180)
    @Max(180)
    originLng?: number;

    @ApiPropertyOptional({ description: 'Radius in km around originLat/Lng to search for pickup' })
    @IsOptional()
    @Transform(({ value }) => parseFloat(value))
    @IsNumber()
    @Min(1)
    radiusKm?: number;

    @ApiPropertyOptional({ description: 'Earliest departure date (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    departureDateFrom?: string;

    @ApiPropertyOptional({ description: 'Latest departure date (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    departureDateTo?: string;

    @ApiPropertyOptional({ enum: ItemCategory })
    @IsOptional()
    @IsEnum(ItemCategory)
    itemCategory?: ItemCategory;

    @ApiPropertyOptional({ description: 'Minimum capacity required (kg)' })
    @IsOptional()
    @Transform(({ value }) => parseFloat(value))
    @IsNumber()
    @Min(0)
    minCapacityKg?: number;
}
