import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { P2pComplianceRecord } from './entities/p2p-compliance-record.entity';
import { P2pWaiver } from './entities/p2p-waiver.entity';
import { P2pShipmentRequest } from './entities/p2p-shipment-request.entity';
import { WaiverStatus } from './enums';
import { AcceptWaiverDto } from './dto/accept-waiver.dto';
import { ReportIssueDto } from './dto/report-issue.dto';
import { PlatformSettingsService, SETTING_KEYS } from '../platform-settings/platform-settings.service';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class ComplianceService {
    constructor(
        @InjectRepository(P2pComplianceRecord)
        private complianceRepo: Repository<P2pComplianceRecord>,

        @InjectRepository(P2pWaiver)
        private waiverRepo: Repository<P2pWaiver>,

        @InjectRepository(P2pShipmentRequest)
        private requestRepo: Repository<P2pShipmentRequest>,

        private platformSettingsService: PlatformSettingsService,
        private documentsService: DocumentsService,
    ) { }

    async getRules(): Promise<{
        platformFeePercent: number;
        defaultRadiusKm: number;
        waiverVersion: string;
        maxWeightKg: number;
        maxDeclaredValueUsd: number;
        restrictedCategories: string[];
    }> {
        const [feePercent, radiusKm, waiverVersion, restrictedCategories, maxDeclaredValueUsd, maxWeightKg] =
            await Promise.all([
                this.platformSettingsService.getP2pFeePercent(),
                this.platformSettingsService.getP2pDefaultRadiusKm(),
                this.platformSettingsService.getP2pWaiverVersion(),
                this.platformSettingsService.getP2pRestrictedCategories(),
                this.platformSettingsService.getP2pMaxDeclaredValueUsd(),
                this.platformSettingsService.getP2pMaxWeightKg(),
            ]);

        return {
            platformFeePercent: feePercent,
            defaultRadiusKm: radiusKm,
            waiverVersion,
            maxWeightKg,
            maxDeclaredValueUsd,
            restrictedCategories,
        };
    }

    async getRestrictedItems(): Promise<{ items: string[] }> {
        const items = await this.platformSettingsService.getP2pProhibitedItems();
        return { items };
    }

    async previewWaiver(shipmentId: string): Promise<{
        shipmentId: string;
        termsVersion: string;
        waiverText: string;
        acknowledgeFlags: string[];
    }> {
        const request = await this.requestRepo.findOne({ where: { id: shipmentId } });
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
                'NO_PROHIBITED_ITEMS',
                'ACCURATE_VALUE_DECLARED',
                'CUSTOMS_RESPONSIBILITY',
                'MARKETPLACE_DISCLAIMER',
            ],
        };
    }

    async acceptWaiver(userId: string, shipmentId: string, dto: AcceptWaiverDto): Promise<P2pWaiver> {
        const request = await this.requestRepo.findOne({ where: { id: shipmentId } });
        if (!request) throw new NotFoundException('Shipment request not found.');

        const termsVersion = await this.platformSettingsService.getP2pWaiverVersion();

        // Expire any existing waivers for this user+shipment
        await this.waiverRepo.update(
            { shipment_request_id: shipmentId, signedByUserId: userId },
            { status: WaiverStatus.EXPIRED },
        );

        const waiver = this.waiverRepo.create({
            shipment_request_id: shipmentId,
            signedByUserId: userId,
            termsVersion,
            acknowledgedFlags: dto.acknowledgedFlags,
            proofMetadata: dto.proofMetadata ?? null,
            status: WaiverStatus.ACCEPTED,
        });

        return this.waiverRepo.save(waiver);
    }

    async getComplianceStatus(shipmentId: string): Promise<{
        record: P2pComplianceRecord | null;
        waiverStatus: string | null;
    }> {
        const record = await this.complianceRepo.findOne({
            where: { shipment_request_id: shipmentId },
        });

        const waiver = await this.waiverRepo.findOne({
            where: { shipment_request_id: shipmentId, status: WaiverStatus.ACCEPTED },
            order: { created_at: 'DESC' },
        });

        return {
            record,
            waiverStatus: waiver?.status ?? null,
        };
    }

    async reportIssue(
        userId: string,
        shipmentId: string,
        dto: ReportIssueDto,
    ): Promise<P2pComplianceRecord> {
        let record = await this.complianceRepo.findOne({
            where: { shipment_request_id: shipmentId },
        });

        if (record) {
            record.manualReviewRequired = true;
            record.rejectionReason = dto.description;
            if (dto.prohibitedItemDetected != null) {
                record.prohibitedItemDetected = dto.prohibitedItemDetected;
            }
            if (dto.restrictedCategoryFlags) {
                record.restrictedCategoryFlags = dto.restrictedCategoryFlags;
            }
        } else {
            record = this.complianceRepo.create({
                shipment_request_id: shipmentId,
                prohibitedItemDetected: dto.prohibitedItemDetected ?? false,
                restrictedCategoryFlags: dto.restrictedCategoryFlags ?? [],
                manualReviewRequired: true,
                rejectionReason: dto.description,
            });
        }

        return this.complianceRepo.save(record);
    }
}
