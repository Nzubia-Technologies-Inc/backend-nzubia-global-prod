import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSetting } from './entities/platform-setting.entity';
import { UpdateSettingDto } from './dto/update-setting.dto';

export const SETTING_KEYS = {
    COMMISSION_RATE: 'COMMISSION_RATE',
    // P2P-specific keys
    P2P_PROHIBITED_ITEMS: 'P2P_PROHIBITED_ITEMS',
    P2P_WAIVER_TEXT: 'P2P_WAIVER_TEXT',
    P2P_PLATFORM_FEE_PERCENT: 'P2P_PLATFORM_FEE_PERCENT',
    P2P_DEFAULT_RADIUS_KM: 'P2P_DEFAULT_RADIUS_KM',
    P2P_WAIVER_VERSION: 'P2P_WAIVER_VERSION',
    P2P_RESTRICTED_CATEGORIES: 'P2P_RESTRICTED_CATEGORIES',
    P2P_MAX_DECLARED_VALUE_USD: 'P2P_MAX_DECLARED_VALUE_USD',
    P2P_MAX_WEIGHT_KG: 'P2P_MAX_WEIGHT_KG',
};

@Injectable()
export class PlatformSettingsService implements OnModuleInit {
    private readonly logger = new Logger(PlatformSettingsService.name);

    constructor(
        @InjectRepository(PlatformSetting)
        private settingsRepo: Repository<PlatformSetting>,
    ) { }

    async onModuleInit() {
        await this.seedDefaults();
    }

    async seedDefaults() {
        const defaults = [
            { key: SETTING_KEYS.COMMISSION_RATE, value: '2.5', description: 'Platform commission rate in percent' },
            {
                key: SETTING_KEYS.P2P_PROHIBITED_ITEMS,
                value: JSON.stringify(['WEAPONS', 'DRUGS', 'EXPLOSIVES', 'COUNTERFEIT', 'LIVE_ANIMALS', 'CURRENCY']),
                description: 'JSON array of prohibited item keywords for P2P shipments',
            },
            {
                key: SETTING_KEYS.P2P_WAIVER_TEXT,
                value: 'I acknowledge that I am shipping personal items via a peer-to-peer courier and accept full responsibility for declared contents, accurate valuations, and compliance with destination country import regulations. I confirm that the shipment contains no prohibited items. I understand Nzubia Global acts as a marketplace only and is not liable for customs seizures, loss, or damage beyond the declared value.',
                description: 'Terms text displayed to seekers before submitting a P2P shipment request',
            },
            {
                key: SETTING_KEYS.P2P_PLATFORM_FEE_PERCENT,
                value: '10',
                description: 'Platform fee percentage charged on P2P courier payments',
            },
            {
                key: SETTING_KEYS.P2P_DEFAULT_RADIUS_KM,
                value: '50',
                description: 'Default pickup proximity radius in km for P2P route matching',
            },
            {
                key: SETTING_KEYS.P2P_WAIVER_VERSION,
                value: '1.0',
                description: 'Current version of the P2P waiver terms',
            },
            {
                key: SETTING_KEYS.P2P_RESTRICTED_CATEGORIES,
                value: JSON.stringify(['DOCUMENTS', 'CLOTHING', 'ELECTRONICS', 'ACCESSORIES', 'FOOD', 'MEDICINE', 'OTHER']),
                description: 'JSON array of allowed item categories for P2P shipments',
            },
            {
                key: SETTING_KEYS.P2P_MAX_DECLARED_VALUE_USD,
                value: '5000',
                description: 'Maximum declared value (USD) allowed for P2P shipments without manual review',
            },
            {
                key: SETTING_KEYS.P2P_MAX_WEIGHT_KG,
                value: '50',
                description: 'Maximum weight (kg) allowed per P2P shipment',
            },
        ];

        for (const def of defaults) {
            const exists = await this.settingsRepo.findOne({ where: { key: def.key } });
            if (!exists) {
                await this.settingsRepo.save(def);
                this.logger.log(`Seeded default setting: ${def.key}`);
            }
        }
    }

    async findAll() {
        return this.settingsRepo.find();
    }

    async findOne(key: string) {
        return this.settingsRepo.findOne({ where: { key } });
    }

    async update(key: string, dto: UpdateSettingDto) {
        await this.settingsRepo.update(key, dto);
        return this.findOne(key);
    }

    async getCommissionRate(): Promise<number> {
        const setting = await this.findOne(SETTING_KEYS.COMMISSION_RATE);
        if (setting && setting.is_active) {
            return parseFloat(setting.value) || 2.5;
        }
        return 2.5;
    }

    async getP2pFeePercent(): Promise<number> {
        const setting = await this.findOne(SETTING_KEYS.P2P_PLATFORM_FEE_PERCENT);
        if (setting && setting.is_active) {
            return parseFloat(setting.value) || 10;
        }
        return 10;
    }

    async getP2pDefaultRadiusKm(): Promise<number> {
        const setting = await this.findOne(SETTING_KEYS.P2P_DEFAULT_RADIUS_KM);
        if (setting && setting.is_active) {
            return parseFloat(setting.value) || 50;
        }
        return 50;
    }

    async getP2pProhibitedItems(): Promise<string[]> {
        const setting = await this.findOne(SETTING_KEYS.P2P_PROHIBITED_ITEMS);
        if (setting && setting.is_active) {
            try {
                return JSON.parse(setting.value) as string[];
            } catch {
                return [];
            }
        }
        return ['WEAPONS', 'DRUGS', 'EXPLOSIVES', 'COUNTERFEIT', 'LIVE_ANIMALS', 'CURRENCY'];
    }

    async getP2pWaiverText(): Promise<string> {
        const setting = await this.findOne(SETTING_KEYS.P2P_WAIVER_TEXT);
        return setting?.value ?? '';
    }

    async getP2pWaiverVersion(): Promise<string> {
        const setting = await this.findOne(SETTING_KEYS.P2P_WAIVER_VERSION);
        return setting?.value ?? '1.0';
    }

    async getP2pRestrictedCategories(): Promise<string[]> {
        const setting = await this.findOne(SETTING_KEYS.P2P_RESTRICTED_CATEGORIES);
        if (setting && setting.is_active) {
            try {
                return JSON.parse(setting.value) as string[];
            } catch {
                return [];
            }
        }
        return ['DOCUMENTS', 'CLOTHING', 'ELECTRONICS', 'ACCESSORIES', 'FOOD', 'MEDICINE', 'OTHER'];
    }

    async getP2pMaxDeclaredValueUsd(): Promise<number> {
        const setting = await this.findOne(SETTING_KEYS.P2P_MAX_DECLARED_VALUE_USD);
        if (setting && setting.is_active) {
            return parseFloat(setting.value) || 5000;
        }
        return 5000;
    }

    async getP2pMaxWeightKg(): Promise<number> {
        const setting = await this.findOne(SETTING_KEYS.P2P_MAX_WEIGHT_KG);
        if (setting && setting.is_active) {
            return parseFloat(setting.value) || 50;
        }
        return 50;
    }
}
