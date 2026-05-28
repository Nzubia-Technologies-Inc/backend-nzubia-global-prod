import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { AgentProfile } from './entities/agent-profile.entity';

import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, AgentProfile]), NotificationsModule],

  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Export for AuthModule
})
export class UsersModule { }
