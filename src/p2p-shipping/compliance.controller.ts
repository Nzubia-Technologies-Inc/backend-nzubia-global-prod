import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ComplianceService } from './compliance.service';
import { AcceptWaiverDto } from './dto/accept-waiver.dto';
import { ReportIssueDto } from './dto/report-issue.dto';
import {
    mapComplianceRecord,
    mapComplianceStatus,
    mapRules,
    mapWaiver,
    mapWaiverPreview,
} from './mappers';

@ApiTags('P2P Shipping')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('p2p/compliance')
export class ComplianceController {
    constructor(private readonly complianceService: ComplianceService) { }

    @Get('rules')
    @ApiOperation({ summary: 'Get current P2P compliance rules from platform settings' })
    async getRules() {
        const rules = await this.complianceService.getRules();
        return mapRules(rules);
    }

    @Get('restricted')
    @ApiOperation({ summary: 'Get list of prohibited / restricted item keywords' })
    getRestrictedItems() {
        return this.complianceService.getRestrictedItems();
    }

    @Get('waiver/:shipmentId')
    @ApiOperation({ summary: 'Preview the waiver text for a given shipment request' })
    async previewWaiver(@Param('shipmentId') shipmentId: string) {
        const preview = await this.complianceService.previewWaiver(shipmentId);
        return mapWaiverPreview(preview);
    }

    @Post('waiver/:shipmentId/accept')
    @ApiOperation({ summary: 'Accept the waiver for a shipment request' })
    async acceptWaiver(
        @Param('shipmentId') shipmentId: string,
        @Body() dto: AcceptWaiverDto,
        @Request() req,
    ) {
        const waiver = await this.complianceService.acceptWaiver(
            req.user.id,
            shipmentId,
            dto,
        );
        return mapWaiver(waiver);
    }

    @Get('status/:shipmentId')
    @ApiOperation({ summary: 'Get compliance record and waiver status for a shipment' })
    async getComplianceStatus(@Param('shipmentId') shipmentId: string) {
        const status = await this.complianceService.getComplianceStatus(shipmentId);
        return mapComplianceStatus(status);
    }

    @Post('issue/:shipmentId')
    @ApiOperation({ summary: 'Report a compliance issue on a shipment' })
    async reportIssue(
        @Param('shipmentId') shipmentId: string,
        @Body() dto: ReportIssueDto,
        @Request() req,
    ) {
        const record = await this.complianceService.reportIssue(
            req.user.id,
            shipmentId,
            dto,
        );
        return mapComplianceRecord(record);
    }
}
