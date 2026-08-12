import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { OrderPaymentService } from '../services/order-payment-webhook.service';
import { InstallmentService } from 'src/modules/finance-module/installment/services/installment.service';
import { INSTALLMENT_REFERENCE_PREFIX } from 'src/modules/finance-module/installment/installment.constants';

@ApiTags('Order Payments')
@Controller('orders/webhook')
export class OrderPaymentController {
  constructor(
    private readonly payments: OrderPaymentService,
    private readonly installments: InstallmentService,
  ) {}

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
    const reference = (body?.data as { reference?: string } | undefined)
      ?.reference;
    if (reference && reference.startsWith(INSTALLMENT_REFERENCE_PREFIX)) {
      await this.installments.handleInstallmentPayment(reference);
      return { received: true };
    }
    await this.payments.handlePaystackWebhook(body);
    return { received: true };
  }
}
