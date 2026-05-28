import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RouteStatus } from '../enums';

export class UpdateRouteStatusDto {
    @ApiProperty({ enum: RouteStatus })
    @IsEnum(RouteStatus)
    status: RouteStatus;
}
