import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ShipmentService } from './shipment.service';
import { CreateShipmentRequestDto } from './dto/create-shipment-request.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { ConfirmPickupDto } from './dto/confirm-pickup.dto';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import { RaiseDisputeDto } from './dto/raise-dispute.dto';
import { SendCourierRequestDto } from './dto/send-courier-request.dto';
import { mapCourierRequest, mapOffer, mapRouteFeedItem, mapShipmentRequest } from './mappers';

@ApiTags('P2P Shipping')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('p2p/shipments')
export class ShipmentController {
    constructor(private readonly shipmentService: ShipmentService) { }

    // ──────────── Requests ────────────

    @Post()
    @ApiOperation({ summary: 'Create a P2P shipment request (runs compliance check)' })
    async createRequest(@Body() dto: CreateShipmentRequestDto, @Request() req) {
        const request = await this.shipmentService.createRequest(req.user.id, dto);
        return mapShipmentRequest(request);
    }

    @Get()
    @ApiOperation({ summary: 'List my shipment requests' })
    async listRequests(@Request() req) {
        const requests = await this.shipmentService.listRequests(req.user.id);
        return requests.map(mapShipmentRequest);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single shipment request by ID' })
    async getRequest(@Param('id') id: string, @Request() req) {
        const request = await this.shipmentService.getRequest(req.user.id, id);
        return mapShipmentRequest(request);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a DRAFT shipment request' })
    async updateRequest(
        @Param('id') id: string,
        @Body() dto: Partial<CreateShipmentRequestDto>,
        @Request() req,
    ) {
        const request = await this.shipmentService.updateRequest(req.user.id, id, dto);
        return mapShipmentRequest(request);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Advance shipment request status (enforces state machine)' })
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateShipmentStatusDto,
        @Request() req,
    ) {
        const request = await this.shipmentService.updateStatus(req.user.id, id, dto);
        return mapShipmentRequest(request);
    }

    // ──────────── Matching ────────────

    @Get(':id/match')
    @ApiOperation({ summary: 'Find top-5 matching routes for a shipment request' })
    async matchRequest(@Param('id') id: string, @Request() req) {
        const scored = await this.shipmentService.matchRequest(req.user.id, id);
        return scored.map(mapRouteFeedItem);
    }

    // ──────────── Offers ────────────

    @Get(':id/offers')
    @ApiOperation({ summary: 'List offers placed on a shipment request' })
    async listOffers(@Param('id') shipmentId: string, @Request() req) {
        const offers = await this.shipmentService.listOffersForShipment(
            req.user.id,
            shipmentId,
        );
        return offers.map(mapOffer);
    }

    @Post(':id/offers')
    @ApiOperation({ summary: 'Courier submits an offer on a shipment request' })
    async createOffer(
        @Param('id') shipmentId: string,
        @Body() dto: CreateOfferDto,
        @Request() req,
    ) {
        const offer = await this.shipmentService.createOffer(req.user.id, shipmentId, dto);
        return mapOffer(offer);
    }

    @Post('offers/:offerId/accept')
    @ApiOperation({ summary: 'Seeker accepts a courier offer (holds payment)' })
    async acceptOffer(@Param('offerId') offerId: string, @Request() req) {
        const offer = await this.shipmentService.acceptOffer(req.user.id, offerId);
        return mapOffer(offer);
    }

    @Post('offers/:offerId/reject')
    @ApiOperation({ summary: 'Seeker rejects a courier offer' })
    async rejectOffer(@Param('offerId') offerId: string, @Request() req) {
        const offer = await this.shipmentService.rejectOffer(req.user.id, offerId);
        return mapOffer(offer);
    }

    // ──────────── Lifecycle ────────────

    @Post(':id/reserve')
    @ApiOperation({
        summary: 'Seeker reserves the shipment after signing the waiver (MATCHED → RESERVED)',
    })
    async reserveShipment(@Param('id') id: string, @Request() req) {
        const request = await this.shipmentService.reserveShipment(req.user.id, id);
        return mapShipmentRequest(request);
    }

    @Post(':id/handoff')
    @ApiOperation({
        summary: 'Initiate handoff — moves to HANDOFF_PENDING, opens chat, sends pickup code to seeker (seeker or courier)',
    })
    async recordHandoff(@Param('id') id: string, @Request() req) {
        const request = await this.shipmentService.recordHandoff(req.user.id, id);
        return mapShipmentRequest(request);
    }

    @Post(':id/pickup')
    @ApiOperation({
        summary: 'Courier confirms physical pickup using the seeker\'s code (HANDOFF_PENDING → IN_TRANSIT)',
    })
    async confirmPickup(
        @Param('id') id: string,
        @Body() dto: ConfirmPickupDto,
        @Request() req,
    ) {
        const request = await this.shipmentService.confirmPickup(req.user.id, id, dto);
        return mapShipmentRequest(request);
    }

    @Post(':id/deliver')
    @ApiOperation({
        summary: 'Courier marks item as delivered at destination (IN_TRANSIT → DELIVERED)',
    })
    async confirmDelivery(
        @Param('id') id: string,
        @Body() dto: ConfirmDeliveryDto,
        @Request() req,
    ) {
        const request = await this.shipmentService.confirmDelivery(req.user.id, id, dto);
        return mapShipmentRequest(request);
    }

    @Post(':id/complete')
    @ApiOperation({
        summary: 'Seeker confirms receipt — releases payment to courier and prompts reviews (DELIVERED → COMPLETED)',
    })
    async completeShipment(@Param('id') id: string, @Request() req) {
        const request = await this.shipmentService.completeShipment(req.user.id, id);
        return mapShipmentRequest(request);
    }

    @Post(':id/dispute')
    @ApiOperation({
        summary: 'Seeker raises a dispute instead of confirming receipt (DELIVERED → DISPUTED)',
    })
    async raiseDispute(
        @Param('id') id: string,
        @Body() dto: RaiseDisputeDto,
        @Request() req,
    ) {
        const request = await this.shipmentService.raiseDispute(req.user.id, id, dto);
        return mapShipmentRequest(request);
    }

    // ──────────── Courier Requests (seeker side) ────────────

    @Post(':id/courier-requests')
    @ApiOperation({
        summary: 'Seeker sends a direct booking request to a specific courier route',
    })
    async sendCourierRequest(
        @Param('id') shipmentId: string,
        @Body() dto: SendCourierRequestDto,
        @Request() req,
    ) {
        const courierRequest = await this.shipmentService.sendCourierRequest(
            req.user.id,
            shipmentId,
            dto,
        );
        return mapCourierRequest(courierRequest);
    }

    @Get(':id/courier-requests')
    @ApiOperation({ summary: 'Seeker lists all direct requests sent for a shipment' })
    async listCourierRequests(@Param('id') shipmentId: string, @Request() req) {
        const requests = await this.shipmentService.listCourierRequestsForShipment(
            req.user.id,
            shipmentId,
        );
        return requests.map(mapCourierRequest);
    }

    @Delete(':id/courier-requests/:requestId')
    @ApiOperation({ summary: 'Seeker cancels a pending courier request' })
    async cancelCourierRequest(
        @Param('id') shipmentId: string,
        @Param('requestId') requestId: string,
        @Request() req,
    ) {
        const courierRequest = await this.shipmentService.cancelCourierRequest(
            req.user.id,
            shipmentId,
            requestId,
        );
        return mapCourierRequest(courierRequest);
    }
}
