import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FilesService {
    private readonly logger = new Logger(FilesService.name);
    private readonly gcsProjectId?: string;
    private readonly gcsClientEmail?: string;
    private readonly gcsPrivateKey?: string;
    private readonly gcsBucketName?: string;
    private accessTokenCache?: { token: string; expiresAt: number };

    constructor(private configService: ConfigService) {
        this.gcsProjectId = this.configService.get<string>('GCS_PROJECT_ID');
        this.gcsClientEmail = this.configService.get<string>('GCS_CLIENT_EMAIL');
        this.gcsPrivateKey = this.configService
            .get<string>('GCS_PRIVATE_KEY')
            ?.trim()
            .replace(/^"|"$/g, '')
            ?.replace(/\\n/g, '\n'); // Handle newline characters in env var
        this.gcsBucketName = this.configService.get<string>('GCS_BUCKET_NAME');

        if (!this.gcsProjectId || !this.gcsClientEmail || !this.gcsPrivateKey || !this.gcsBucketName) {
            this.logger.warn('GCS credentials missing. File upload disabled.');
        }
    }

    async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<string> {
        if (!this.gcsProjectId || !this.gcsClientEmail || !this.gcsPrivateKey || !this.gcsBucketName) {
            throw new Error('Storage not configured');
        }

        const filename = `${uuidv4()}${path.extname(file.originalname)}`;
        const destination = `${folder}/${filename}`;

        try {
            const accessToken = await this.getAccessToken();
            const uploadUrl = new URL(
                `https://storage.googleapis.com/upload/storage/v1/b/${this.gcsBucketName}/o`,
            );
            uploadUrl.searchParams.set('uploadType', 'media');
            uploadUrl.searchParams.set('name', destination);

            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': file.mimetype,
                },
                body: new Uint8Array(file.buffer),
            });

            if (!response.ok) {
                const responseText = await response.text();
                throw new Error(`GCS upload failed (${response.status}): ${responseText}`);
            }

            // Construct public URL (assuming bucket is public or we use signed URLs).
            return `https://storage.googleapis.com/${this.gcsBucketName}/${destination}`;
        } catch (err) {
            const error = err as {
                message?: string;
                code?: string | number;
                errors?: unknown;
                response?: { statusCode?: number; data?: unknown };
                cause?: unknown;
            };
            this.logger.error(
                `Upload error: ${error.message ?? 'Unknown upload error'} | code=${error.code ?? 'n/a'} | status=${error.response?.statusCode ?? 'n/a'} | errors=${JSON.stringify(error.errors ?? null)} | response=${JSON.stringify(error.response?.data ?? null)}`,
            );
            throw err;
        }
    }

    private async getAccessToken(): Promise<string> {
        if (this.accessTokenCache && Date.now() < this.accessTokenCache.expiresAt - 60000) {
            return this.accessTokenCache.token;
        }

        const issuedAt = Math.floor(Date.now() / 1000);
        const header = this.base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
        const payload = this.base64UrlEncode(
            JSON.stringify({
                iss: this.gcsClientEmail,
                scope: 'https://www.googleapis.com/auth/devstorage.read_write',
                aud: 'https://oauth2.googleapis.com/token',
                iat: issuedAt,
                exp: issuedAt + 3600,
            }),
        );
        const signer = createSign('RSA-SHA256');
        signer.update(`${header}.${payload}`);
        signer.end();
        const signature = this.base64UrlEncode(signer.sign(this.gcsPrivateKey!));
        const assertion = `${header}.${payload}.${signature}`;

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion,
            }),
        });

        if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`Failed to obtain GCS access token (${response.status}): ${responseText}`);
        }

        const data = (await response.json()) as { access_token?: string; expires_in?: number };
        if (!data.access_token) {
            throw new Error('Failed to obtain GCS access token: access_token missing');
        }

        this.accessTokenCache = {
            token: data.access_token,
            expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
        };

        return data.access_token;
    }

    private base64UrlEncode(input: string | Buffer): string {
        return Buffer.from(input)
            .toString('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }
}
