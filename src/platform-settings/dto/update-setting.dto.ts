import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingDto {
    @ApiProperty()
    @IsString()
    @IsOptional()
    value?: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty()
    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}
