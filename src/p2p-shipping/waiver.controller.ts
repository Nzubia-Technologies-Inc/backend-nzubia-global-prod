import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WaiverService } from './waiver.service';
import { AcceptWaiverDto } from './dto/accept-waiver.dto';
import { mapWaiver, mapWaiverPreview } from './mappers';

@ApiTags('P2P Shipping')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('p2p/shipments')
export class WaiverController {
    constructor(private readonly waiverService: WaiverService) {}

    @Get(':id/waiver')
    @ApiOperation({ summary: 'Preview waiver terms for a MATCHED shipment (seeker only)' })
    async previewWaiver(@Param('id') id: string, @Request() req) {
        const preview = await this.waiverService.previewWaiver(req.user.id, id);
        return mapWaiverPreview(preview);
    }

    @Post(':id/waiver/sign')
    @ApiOperation({ summary: 'Seeker signs the waiver — required before reserving the shipment' })
    async signWaiver(@Param('id') id: string, @Body() dto: AcceptWaiverDto, @Request() req) {
        const waiver = await this.waiverService.signWaiver(req.user.id, id, dto);
        return mapWaiver(waiver);
    }

    @Get(':id/waiver/status')
    @ApiOperation({ summary: 'Get the waiver record for a shipment (seeker only)' })
    async getWaiver(@Param('id') id: string, @Request() req) {
        const waiver = await this.waiverService.getWaiver(req.user.id, id);
        return waiver ? mapWaiver(waiver) : { status: 'NOT_SIGNED' };
    }
}
