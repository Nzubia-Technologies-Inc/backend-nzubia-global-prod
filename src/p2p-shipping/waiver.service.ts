import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { P2pWaiver } from './entities/p2p-waiver.entity';
import { P2pShipmentRequest } from './entities/p2p-shipment-request.entity';
import { WaiverStatus, ShipmentRequestStatus } from './enums';
import { AcceptWaiverDto } from './dto/accept-waiver.dto';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

@Injectable()
export class WaiverService {
    constructor(
        @InjectRepository(P2pWaiver)
        private waiverRepo: Repository<P2pWaiver>,

        @InjectRepository(P2pShipmentRequest)
        private requestRepo: Repository<P2pShipmentRequest>,

        private platformSettingsService: PlatformSettingsService,
    ) {}

    async previewWaiver(userId: string, shipmentId: string) {
        const request = await this.requestRepo.findOne({
            where: { id: shipmentId, seeker_user_id: userId },
        });
        if (!request) throw new NotFoundException('Shipment request not found.');

        const [waiverText, termsVersion] = await Promise.all([
            this.platformSettingsService.getP2pWaiverText(),
            this.platformSettingsService.getP2pWaiverVersion(),
        ]);

        return {
            shipmentId,
            termsVersion,
            waiverText,
            acknowledgeFlags: [
                'ACCEPT_RESPONSIBILITY_FOR_CONTENTS',
                'ACCURATE_DECLARED_VALUE',
                'NO_PROHIBITED_ITEMS',
                'CUSTOMS_COMPLIANCE',
                'PLATFORM_NOT_LIABLE',
            ],
        };
    }

    async signWaiver(userId: string, shipmentId: string, dto: AcceptWaiverDto): Promise<P2pWaiver> {
        const request = await this.requestRepo.findOne({
            where: { id: shipmentId, seeker_user_id: userId },
        });
        if (!request) throw new NotFoundException('Shipment request not found.');

        if (request.status !== ShipmentRequestStatus.MATCHED) {
            throw new BadRequestException(
                `Waiver can only be signed when shipment is MATCHED (current: ${request.status}).`,
            );
        }

        // Idempotent: if already signed, return existing
        const existing = await this.waiverRepo.findOne({
            where: { shipment_request_id: shipmentId, signedByUserId: userId },
        });
        if (existing && existing.status === WaiverStatus.ACCEPTED) {
            return existing;
        }

        const termsVersion = await this.platformSettingsService.getP2pWaiverVersion();

        const waiver = this.waiverRepo.create({
            shipment_request_id: shipmentId,
            signedByUserId: userId,
            termsVersion,
            acknowledgedFlags: dto.acknowledgedFlags,
            proofMetadata: dto.proofMetadata ?? { signedAt: new Date().toISOString() },
            status: WaiverStatus.ACCEPTED,
        });

        return this.waiverRepo.save(waiver);
    }

    async getWaiver(userId: string, shipmentId: string): Promise<P2pWaiver | null> {
        const request = await this.requestRepo.findOne({
            where: { id: shipmentId, seeker_user_id: userId },
        });
        if (!request) throw new NotFoundException('Shipment request not found.');

        return this.waiverRepo.findOne({
            where: { shipment_request_id: shipmentId, signedByUserId: userId },
        });
    }

    async isWaiverSigned(userId: string, shipmentId: string): Promise<boolean> {
        const waiver = await this.waiverRepo.findOne({
            where: { shipment_request_id: shipmentId, signedByUserId: userId },
        });
        return waiver?.status === WaiverStatus.ACCEPTED;
    }
}
