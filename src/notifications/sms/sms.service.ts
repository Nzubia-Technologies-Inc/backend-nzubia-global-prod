import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Twilio from 'twilio';

@Injectable()
export class SmsService {
    private client: Twilio.Twilio;
    private readonly logger = new Logger(SmsService.name);

    constructor(private configService: ConfigService) {
        const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
        const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

        if (accountSid && authToken) {
            this.client = new Twilio.Twilio(accountSid, authToken);
        } else {
            this.logger.warn('Twilio credentials not found. SMS service disabled.');
        }
    }

    async sendSms(to: string, body: string) {
        if (!this.client) {
            this.logger.warn(`SMS simulation (Twilio not configured): To ${to}, Body: ${body}`);
            return;
        }

        try {
            const from = this.configService.get<string>('TWILIO_PHONE_NUMBER');
            const message = await this.client.messages.create({
                body,
                from,
                to,
            });
            this.logger.log(`SMS sent to ${to}: ${message.sid}`);
            return message;
        } catch (error) {
            this.logger.error(`Failed to send SMS to ${to}`, error.stack);
        }
    }
}
