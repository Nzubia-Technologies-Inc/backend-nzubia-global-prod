import { Controller, Post, Body, Headers, Req, UseGuards, BadRequestException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../users/users.service';
import type { Request } from 'express'; // Import type

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly usersService: UsersService,
  ) { }

  @Post('create-intent')
  @UseGuards(AuthGuard('jwt'))
  async createIntent(@Body() dto: CreatePaymentDto) {
    let connectId: string | undefined = undefined; // Explicit type
    if (dto.agentId) {
      const agent = await this.usersService.findOne(dto.agentId);
      connectId = agent?.agentProfile?.stripe_connect_id || undefined;
      if (!connectId) {
        // Fallback or error depending on business logic. 
        // If agent hasn't connected stripe yet, we might want to hold funds on platform.
        // For now, proceed without transfer (funds stay in platform) or throw error.
      }
    }
    return this.paymentsService.createPaymentIntent(dto.amount, dto.currency, connectId);
  }

  @Post('webhook')
  async handleWebhook(@Headers('stripe-signature') signature: string, @Req() req: RawBodyRequest<Request>) {
    if (!signature) throw new BadRequestException('Missing Signature');
    // Important: Raw body needed for Stripe signature verification
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Missing Body');
    await this.paymentsService.handleWebhook(signature, rawBody);
    return { received: true };
  }
}
