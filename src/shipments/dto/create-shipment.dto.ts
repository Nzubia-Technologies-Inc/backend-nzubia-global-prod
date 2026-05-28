import { IsNotEmpty, IsString, IsNumber, IsOptional, ValidateNested, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class AddressDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    address: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    lat?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    lng?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    country?: string;
}

class CargoMetaDto {
    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty()
    @IsNumber()
    weight: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_hazardous?: boolean;

    @ApiProperty({ enum: ['AIR', 'SEA', 'LAND'] })
    @IsEnum(['AIR', 'SEA', 'LAND'])
    service_type: 'AIR' | 'SEA' | 'LAND';
}

export class CreateShipmentDto {
    @ApiProperty()
    @ValidateNested()
    @Type(() => AddressDto)
    origin: AddressDto;

    @ApiProperty()
    @IsString()
    destination_country: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    destination_meta?: AddressDto;

    @ApiProperty()
    @ValidateNested()
    @Type(() => CargoMetaDto)
    cargo_meta: CargoMetaDto;
}
