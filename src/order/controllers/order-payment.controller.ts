import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { OrderPaymentService } from '../services/order-payment.service';

@Controller('orders/webhook')
export class OrderPaymentController {
  constructor(private readonly payments: OrderPaymentService) {}

  @Post('paystack')
  @HttpCode(200) // important for Paystack
  async handleWebhook(@Body() payload: any) {
    await this.payments.handlePaystackWebhook(payload);
    return { received: true };
  }
}
