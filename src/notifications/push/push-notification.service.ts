import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

@Injectable()
export class PushNotificationService {
    private readonly logger = new Logger(PushNotificationService.name);
    private readonly appId: string;
    private readonly apiKey: string;

    constructor(private configService: ConfigService) {
        this.appId = this.configService.get<string>('ONESIGNAL_APP_ID') ?? '';
        this.apiKey = this.configService.get<string>('ONESIGNAL_API_KEY') ?? '';
    }

    /**
     * Send a push notification to one or more users identified by their
     * backend user UUIDs (mapped to OneSignal external_id via OneSignal.login()).
     */
    async sendToUsers(
        userIds: string[],
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<void> {
        if (!userIds.length || !this.appId || !this.apiKey) {
            if (!this.appId || !this.apiKey) {
                this.logger.warn('ONESIGNAL_APP_ID or ONESIGNAL_API_KEY not configured — skipping push');
            }
            return;
        }

        const payload = JSON.stringify({
            app_id: this.appId,
            include_aliases: { external_id: userIds },
            target_channel: 'push',
            headings: { en: title },
            contents: { en: body },
            ...(data ? { data } : {}),
        });

        await new Promise<void>((resolve) => {
            const req = https.request(
                {
                    hostname: 'api.onesignal.com',
                    path: '/notifications',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Key ${this.apiKey}`,
                        'Content-Length': Buffer.byteLength(payload),
                    },
                },
                (res) => {
                    res.resume();
                    if (res.statusCode && res.statusCode >= 300) {
                        this.logger.warn(`OneSignal returned ${res.statusCode} for ${userIds.length} users`);
                    }
                    resolve();
                },
            );
            req.on('error', (err) =>
                this.logger.warn(`OneSignal push failed: ${err.message}`),
            );
            req.on('error', () => resolve());
            req.write(payload);
            req.end();
        });
    }
}
