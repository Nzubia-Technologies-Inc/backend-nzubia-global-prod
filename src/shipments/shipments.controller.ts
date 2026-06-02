import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ShipmentStatus } from './entities/shipment.entity';

@ApiTags('Shipments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) { }

  @Post()
  create(@Body() createShipmentDto: CreateShipmentDto, @Request() req) {
    return this.shipmentsService.create(createShipmentDto, req.user); // JWT strategy attaches valid user to req.user (payload)
    // Note: req.user from JWT strategy currently returns payload {sub, email, role}. 
    // Ideally we should resolve full user or just pass ID. Service expects User entity.
    // Let's adjust Service to take ID or object with ID.
    // Actually, TypeORM create/save works with partial object {id: ...} for relations usually.
  }

  @Get()
  @ApiQuery({ name: 'status', enum: ShipmentStatus, required: false })
  findAll(@Query('status') status?: ShipmentStatus) {
    return this.shipmentsService.findAll(status);
  }

  @Get(':id/details')
  findOneDetails(@Param('id') id: string) {
    return this.shipmentsService.findOne(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shipmentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateShipmentDto: UpdateShipmentDto) {
    return this.shipmentsService.update(id, updateShipmentDto);
  }

  @Get('track/:id')
  async track(@Param('id') id: string) {
    const shipment = await this.shipmentsService.findOne(id);
    if (!shipment) return { error: 'Shipment not found' };

    // Return sanitized public info
    return {
      id: shipment.id,
      status: shipment.status,
      origin_city: shipment.origin?.address, // Assuming city is derived or part of address string
      destination_country: shipment.destination_country,
      updates: shipment.updated_at,
    };
  }
}
