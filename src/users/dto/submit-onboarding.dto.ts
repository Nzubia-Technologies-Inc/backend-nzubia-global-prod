import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

export class SubmitOnboardingDto {
    @IsString()
    @IsOptional()
    agent_type?: string;

    @IsString()
    @IsOptional()
    company_name?: string;

    @IsString()
    @IsOptional()
    business_reg_number?: string;

    @IsString()
    @IsOptional()
    tax_id?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    license_number?: string;

    @IsString()
    @IsOptional()
    insurance_certificate_url?: string;

    @IsString()
    @IsOptional()
    id_type?: string;

    @IsString()
    @IsOptional()
    id_number?: string;

    @IsString()
    @IsOptional()
    id_document_url?: string;

    @IsString()
    @IsOptional()
    selfie_url?: string;

    @IsNumber()
    @IsOptional()
    service_radius_km?: number;

    @IsNumber()
    @IsOptional()
    years_in_business?: number;

    @IsNumber()
    @IsOptional()
    fleet_size?: number;

    @IsArray()
    @IsOptional()
    cargo_specializations?: string[];

    @IsArray()
    @IsOptional()
    service_regions?: string[];
}
