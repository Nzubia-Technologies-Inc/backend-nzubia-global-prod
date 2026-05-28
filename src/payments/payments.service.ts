import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { User } from '../users/entities/user.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;
  private logger = new Logger(PaymentsService.name);

  constructor(
    private configService: ConfigService,
    private platformSettingsService: PlatformSettingsService,
  ) {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (apiKey) {
      this.stripe = new Stripe(apiKey, {
        apiVersion: '2024-12-18.acacia' as any, // Cast to any to avoid version mismatch errors with different SDK versions
      });
    } else {
      this.logger.warn('Stripe API Key missing');
    }
  }

  async createPaymentIntent(amount: number, currency: string, agentConnectId?: string) {
    // Dynamic Platform Fee
    const commissionRate = await this.platformSettingsService.getCommissionRate();
    const platformFee = Math.round(amount * (commissionRate / 100));

    // Default params
    const params: Stripe.PaymentIntentCreateParams = {
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
    };

    // If Agent Connected Account is provided, route funds
    if (agentConnectId) {
      params.application_fee_amount = platformFee;
      params.transfer_data = {
        destination: agentConnectId,
      };
    }

    try {
      const intent = await this.stripe.paymentIntents.create(params);
      return { clientSecret: intent.client_secret, id: intent.id };
    } catch (error) {
      this.logger.error(`Stripe Error: ${error.message}`);
      throw error;
    }
  }

  async releaseFunds(shipmentId: string) {
    this.logger.log(`Releasing funds for Shipment ${shipmentId} (Escrow Logic Placeholder)`);
    // In a real implementation with Stripe Connect Separate Charges & Transfers:
    // 1. Retrieve the PaymentIntent
    // 2. Perform a Transfer to the Agent's Stripe Account
    // 3. Or if using "capture_method: manual", capture the funds now.
    return { success: true, message: 'Funds release triggered' };
  }


  // Webhook handler stub
  async handleWebhook(signature: string, payload: Buffer) {
    const endpointSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || ''; // Ensure not undefined
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new Error('Webhook Error');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        this.logger.log(`Payment succeeded: ${paymentIntent.id}`);
        // TODO: Update Shipment/Quote status here via ShipmentsService
        break;
      default:
        this.logger.log(`Unhandled event type ${event.type}`);
    }
  }
}
