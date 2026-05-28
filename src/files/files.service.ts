import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, Bucket } from '@google-cloud/storage';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FilesService {
    private storage: Storage;
    private bucket: Bucket;
    private readonly logger = new Logger(FilesService.name);

    constructor(private configService: ConfigService) {
        const projectId = this.configService.get<string>('GCS_PROJECT_ID');
        const clientEmail = this.configService.get<string>('GCS_CLIENT_EMAIL');
        const privateKey = this.configService
            .get<string>('GCS_PRIVATE_KEY')
            ?.replace(/\\n/g, '\n'); // Handle newline characters in env var
        const bucketName = this.configService.get<string>('GCS_BUCKET_NAME');

        if (projectId && clientEmail && privateKey && bucketName) {
            this.storage = new Storage({
                projectId,
                credentials: {
                    client_email: clientEmail,
                    private_key: privateKey,
                },
            });
            this.bucket = this.storage.bucket(bucketName);
        } else {
            this.logger.warn('GCS credentials missing. File upload disabled.');
        }
    }

    async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<string> {
        if (!this.bucket) {
            throw new Error('Storage not configured');
        }

        const filename = `${uuidv4()}${path.extname(file.originalname)}`;
        const destination = `${folder}/${filename}`;
        const blob = this.bucket.file(destination);

        return new Promise((resolve, reject) => {
            const blobStream = blob.createWriteStream({
                resumable: false,
                contentType: file.mimetype,
            });

            blobStream.on('error', (err) => {
                this.logger.error(`Upload error: ${err.message}`);
                reject(err);
            });

            blobStream.on('finish', () => {
                // Construct public URL (assuming bucket is public or we use signed URLs, here using standard public link format)
                // If bucket is private, we might need simple authenticated read or signed URLs.
                // For now, returning the public storage URI.
                const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${destination}`;
                resolve(publicUrl);
            });

            blobStream.end(file.buffer);
        });
    }
}
