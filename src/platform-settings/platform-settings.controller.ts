import { Controller, Get, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
// import { RolesGuard } from '../common/guards/roles.guard'; // Assuming you have one, or just stick to Auth for now

@ApiTags('Platform Settings')
@Controller('platform-settings')
@UseGuards(AuthGuard('jwt')) // TODO: Add Role Guard for ADMIN only
export class PlatformSettingsController {
    constructor(private readonly settingsService: PlatformSettingsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all platform settings' })
    findAll() {
        return this.settingsService.findAll();
    }

    @Get(':key')
    @ApiOperation({ summary: 'Get a specific setting by key' })
    findOne(@Param('key') key: string) {
        return this.settingsService.findOne(key);
    }

    @Patch(':key')
    @ApiOperation({ summary: 'Update a setting' })
    update(@Param('key') key: string, @Body() updateSettingDto: UpdateSettingDto) {
        return this.settingsService.update(key, updateSettingDto);
    }
}
