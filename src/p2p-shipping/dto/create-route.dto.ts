import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsDateString,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';
import { ItemCategory } from '../enums';

export class CreateRouteDto {
    @ApiProperty()
    @IsString()
    destinationCountry: string;

    @ApiProperty()
    @IsString()
    destinationCity: string;

    @ApiProperty({ description: 'ISO 8601 date (YYYY-MM-DD)' })
    @IsDateString()
    departureDate: string;

    @ApiPropertyOptional({ description: 'ISO 8601 date — leave blank for one-way trips' })
    @IsOptional()
    @IsDateString()
    returnDate?: string;

    @ApiProperty({ description: 'Human-readable pickup address or area' })
    @IsString()
    pickupOrigin: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(-90)
    @Max(90)
    pickupLatitude?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(-180)
    @Max(180)
    pickupLongitude?: number;

    @ApiProperty({ description: 'Max cargo weight the courier can carry (kg)' })
    @IsNumber()
    @Min(0.1)
    @Max(50)
    capacityKg: number;

    @ApiPropertyOptional({ enum: ItemCategory, isArray: true })
    @IsOptional()
    @IsArray()
    @IsEnum(ItemCategory, { each: true })
    acceptedItemCategories?: ItemCategory[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    routeNotes?: string;
}
