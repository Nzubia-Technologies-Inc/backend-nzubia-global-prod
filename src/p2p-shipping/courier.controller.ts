import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CourierService } from './courier.service';
import { ShipmentService } from './shipment.service';
import { CreateCourierProfileDto } from './dto/create-courier-profile.dto';
import { UpdateCourierProfileDto } from './dto/update-courier-profile.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { AcceptCourierRequestDto, DeclineCourierRequestDto } from './dto/respond-courier-request.dto';
import {
    mapCourierProfile,
    mapCourierRequest,
    mapCourierStatus,
    mapOffer,
    mapReputation,
} from './mappers';

@ApiTags('P2P Shipping')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('p2p/couriers')
export class CourierController {
    constructor(
        private readonly courierService: CourierService,
        private readonly shipmentService: ShipmentService,
    ) { }

    @Post('me')
    @ApiOperation({ summary: 'Apply as a P2P courier — creates profile in DRAFT state' })
    async applyAsCourier(@Body() dto: CreateCourierProfileDto, @Request() req) {
        const profile = await this.courierService.applyAsCourier(req.user.id, dto);
        return mapCourierProfile(profile);
    }

    @Get('me')
    @ApiOperation({ summary: 'Get my courier profile' })
    async getMyProfile(@Request() req) {
        const profile = await this.courierService.getMyProfile(req.user.id);
        return mapCourierProfile(profile);
    }

    @Patch('me')
    @ApiOperation({ summary: 'Update my courier profile' })
    async updateMyProfile(@Body() dto: UpdateCourierProfileDto, @Request() req) {
        const profile = await this.courierService.updateMyProfile(req.user.id, dto);
        return mapCourierProfile(profile);
    }

    @Patch('me/approve-test')
    @ApiOperation({ summary: 'Test-only: approve my courier profile' })
    async approveMyProfileForTesting(@Request() req) {
        const profile = await this.courierService.approveMyProfileForTesting(req.user.id);
        return mapCourierProfile(profile);
    }

    @Patch('me/availability')
    @ApiOperation({ summary: 'Toggle courier availability (must be APPROVED)' })
    async setAvailability(@Body() dto: SetAvailabilityDto, @Request() req) {
        const profile = await this.courierService.setAvailability(req.user.id, dto.isActive);
        return mapCourierProfile(profile);
    }

    @Get('me/status')
    @ApiOperation({ summary: 'Get courier verification state and active flag' })
    async getStatus(@Request() req) {
        const status = await this.courierService.getStatus(req.user.id);
        return mapCourierStatus(status);
    }

    @Get()
    @ApiOperation({ summary: 'List public courier profiles (ACTIVE/APPROVED only)' })
    @ApiQuery({ name: 'destinationCountry', required: false })
    @ApiQuery({ name: 'destinationCity', required: false })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async listPublic(
        @Query('destinationCountry') destinationCountry?: string,
        @Query('destinationCity') destinationCity?: string,
        @Query('limit') limit?: string,
    ) {
        const couriers = await this.courierService.listPublicCouriers({
            destinationCountry,
            destinationCity,
            limit: limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20,
        });
        return couriers.map(mapCourierProfile);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a public courier profile by ID' })
    async getPublicProfile(@Param('id') id: string) {
        const profile = await this.courierService.getPublicProfile(id);
        return mapCourierProfile(profile);
    }

    @Get(':id/reputation')
    @ApiOperation({ summary: 'Get aggregated reputation for a courier profile by ID' })
    async getReputation(@Param('id') id: string) {
        const rep = await this.courierService.getReputation(id);
        return mapReputation(rep);
    }

    // ──────────── Incoming requests (courier dashboard) ────────────

    @Get('me/requests')
    @ApiOperation({
        summary: 'Courier lists all direct shipment requests sent by seekers (dashboard)',
    })
    async listIncomingRequests(@Request() req) {
        const requests = await this.shipmentService.listIncomingCourierRequests(req.user.id);
        return requests.map(mapCourierRequest);
    }

    @Post('me/requests/:requestId/accept')
    @ApiOperation({
        summary: 'Courier accepts a direct request — creates an offer for the seeker to confirm',
    })
    async acceptRequest(
        @Param('requestId') requestId: string,
        @Body() dto: AcceptCourierRequestDto,
        @Request() req,
    ) {
        const result = await this.shipmentService.acceptCourierRequest(req.user.id, requestId, dto);
        return {
            courier_request: mapCourierRequest(result.courierRequest),
            offer: mapOffer(result.offer),
        };
    }

    @Post('me/requests/:requestId/decline')
    @ApiOperation({ summary: 'Courier declines a direct request' })
    async declineRequest(
        @Param('requestId') requestId: string,
        @Body() dto: DeclineCourierRequestDto,
        @Request() req,
    ) {
        const courierRequest = await this.shipmentService.declineCourierRequest(
            req.user.id,
            requestId,
            dto,
        );
        return mapCourierRequest(courierRequest);
    }
}
