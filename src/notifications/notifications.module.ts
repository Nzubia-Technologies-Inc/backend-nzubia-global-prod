import { Module } from '@nestjs/common';
import { EmailService } from './email/email.service';
import { SmsService } from './sms/sms.service';
import { PushNotificationService } from './push/push-notification.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [EmailService, SmsService, PushNotificationService],
  exports: [EmailService, SmsService, PushNotificationService],
})
export class NotificationsModule { }
