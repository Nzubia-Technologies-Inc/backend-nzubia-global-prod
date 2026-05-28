import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformSetting } from './entities/platform-setting.entity';

@Global() // Making it global so we don't have to import it everywhere manually
@Module({
    imports: [TypeOrmModule.forFeature([PlatformSetting])],
    controllers: [PlatformSettingsController],
    providers: [PlatformSettingsService],
    exports: [PlatformSettingsService],
})
export class PlatformSettingsModule { }
