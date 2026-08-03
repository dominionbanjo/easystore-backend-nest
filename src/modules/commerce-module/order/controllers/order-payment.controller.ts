import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { OrderPaymentService } from '../services/order-payment-webhook.service';

@ApiTags('Order Payments')
@Controller('orders/webhook')
export class OrderPaymentController {
  constructor(private readonly payments: OrderPaymentService) {}

  @ApiOperation({
    summary: 'Handle Paystack payment webhook',
    description:
      'Receives and processes Paystack webhook events for payment status updates.',
  })
  @ApiBody({ description: 'Paystack webhook event payload', type: Object })
  @ApiOkResponse({ description: 'Webhook received and processed' })
  @Post('paystack')
  @HttpCode(200) // important for Paystack
  async handleWebhook(@Body() body: Record<string, unknown>) {
    await this.payments.handlePaystackWebhook(body);
    return { received: true };
  }
}
