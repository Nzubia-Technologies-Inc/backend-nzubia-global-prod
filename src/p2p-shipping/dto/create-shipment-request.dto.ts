import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ItemCategory } from '../enums';

class DimensionsDto {
    @ApiProperty()
    @IsNumber()
    @Min(0)
    length: number;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    width: number;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    height: number;
}

export class CreateShipmentRequestDto {
    @ApiProperty()
    @IsString()
    originAddress: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(-90)
    @Max(90)
    originLatitude?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(-180)
    @Max(180)
    originLongitude?: number;

    @ApiProperty()
    @IsString()
    destinationCountry: string;

    @ApiProperty()
    @IsString()
    destinationCity: string;

    @ApiProperty({ enum: ItemCategory })
    @IsEnum(ItemCategory)
    itemCategory: ItemCategory;

    @ApiProperty()
    @IsString()
    itemDescription: string;

    @ApiPropertyOptional({ type: DimensionsDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DimensionsDto)
    dimensionsCm?: DimensionsDto;

    @ApiProperty()
    @IsNumber()
    @Min(0.01)
    @Max(50)
    weightKg: number;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    declaredValueUsd: number;

    @ApiPropertyOptional({ isArray: true, type: String })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    photoUrls?: string[];
}
