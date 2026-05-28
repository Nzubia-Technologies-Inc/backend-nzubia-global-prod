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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RouteService } from './route.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { UpdateRouteStatusDto } from './dto/update-route-status.dto';
import { RouteFiltersDto } from './dto/route-filters.dto';
import { mapRoute, mapRouteFeedItem } from './mappers';

@ApiTags('P2P Shipping')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('p2p/routes')
export class RouteController {
    constructor(private readonly routeService: RouteService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new travel route (courier must be ACTIVE)' })
    async createRoute(@Body() dto: CreateRouteDto, @Request() req) {
        const route = await this.routeService.createRoute(req.user.id, dto);
        return mapRoute(route);
    }

    @Get('mine')
    @ApiOperation({ summary: 'List routes belonging to the authenticated courier' })
    async listMyRoutes(@Request() req) {
        const routes = await this.routeService.listMyRoutes(req.user.id);
        return routes.map(mapRoute);
    }

    @Get('feed')
    @ApiOperation({ summary: 'Get ranked route feed using composite scoring formula' })
    async getRouteFeed(@Query() filters: RouteFiltersDto) {
        const scored = await this.routeService.getRouteFeed(filters);
        return scored.map(mapRouteFeedItem);
    }

    @Get()
    @ApiOperation({ summary: 'List published routes with optional filters' })
    async listRoutes(@Query() filters: RouteFiltersDto) {
        const routes = await this.routeService.listRoutes(filters);
        return routes.map(mapRoute);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single route by ID' })
    async getRoute(@Param('id') id: string) {
        const route = await this.routeService.getRoute(id);
        return mapRoute(route);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a route you own' })
    async updateRoute(@Param('id') id: string, @Body() dto: UpdateRouteDto, @Request() req) {
        const route = await this.routeService.updateRoute(req.user.id, id, dto);
        return mapRoute(route);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update the status of a route you own' })
    async updateRouteStatus(
        @Param('id') id: string,
        @Body() dto: UpdateRouteStatusDto,
        @Request() req,
    ) {
        const route = await this.routeService.updateRouteStatus(req.user.id, id, dto);
        return mapRoute(route);
    }

    @Post('notify-expiring')
    @ApiOperation({ summary: 'Send 48h expiry reminders to couriers with routes departing soon (admin/cron use)' })
    notifyExpiringRoutes() {
        return this.routeService.notifyExpiringRoutes();
    }
}
