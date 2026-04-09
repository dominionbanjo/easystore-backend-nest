import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

@Injectable()
export class EscrowMailService {
  private readonly brandColor = '#6366f1';
  private readonly baseUrl = process.env.FRONTEND_URL || 'https://eazystore.com.ng';

  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {}

  /* ------------------------------------------------------------
       1. ESCROW CREATED (BUYER)
  ------------------------------------------------------------ */
  async sendEscrowCreatedBuyer({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const title = 'Payment Secured in Escrow 🔒';
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>An escrow has been successfully initialized for your order <b>#${order_id.split('-')[0].toUpperCase()}</b>.</p>
      
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 25px; border-radius: 12px; margin: 30px 0; text-align: center;">
        <div style="font-size: 40px; margin-bottom: 10px;">🛡️</div>
        <h3 style="margin: 0; color: #166534;">Your Purchase is Protected</h3>
        <p style="margin-top: 10px; font-size: 14px; color: #166534;">
          Your money is safely held by EazyStore and will only be released to the vendor after you confirm you've received your order.
        </p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View Order Status', `${this.baseUrl}/orders/${order_id}`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Escrow Secured: Order #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  /* ------------------------------------------------------------
       2. ESCROW CREATED (VENDOR)
  ------------------------------------------------------------ */
  async sendEscrowCreatedVendor({
    email,
    name,
    order_id,
    amount,
  }: {
    email: string;
    name: string;
    order_id: string;
    amount: number;
  }) {
    const title = 'Escrow Initialized';
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>An escrow has been created for order <b>#${order_id.split('-')[0].toUpperCase()}</b>.</p>
      
      <div style="background-color: #f3f4f6; padding: 25px; border-radius: 12px; margin: 30px 0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Pending Payout</p>
        <p style="margin: 10px 0 0; font-size: 32px; font-weight: 800; color: #111827;">₦${amount.toLocaleString()}</p>
      </div>

      <p style="text-align: center; color: #4b5563;">
        You will receive these funds in your wallet immediately after the customer confirms delivery.
      </p>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Process Order', `${this.baseUrl}/vendor/orders/${order_id}`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Escrow Started: Order #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  /* ------------------------------------------------------------
       3. ESCROW FUNDED (BUYER)
  ------------------------------------------------------------ */
  async sendEscrowFundedBuyer({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const title = 'Escrow Funded Successfully';
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your payment for order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been successfully secured in escrow.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-top: 25px;">
        <p style="margin: 0; font-size: 14px; color: #475569;">
          <b>Note:</b> The vendor has been notified and will begin processing your delivery shortly. Your funds remain protected.
        </p>
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: 'Escrow Successfully Funded',
      html,
    });
  }

  /* ------------------------------------------------------------
       4. ESCROW FUNDED (VENDOR)
  ------------------------------------------------------------ */
  async sendEscrowFundedVendor({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const title = 'Payment Confirmed in Escrow';
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>The payment for order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been funded and is being held in escrow.</p>
      <p>You can now proceed with fulfillment. Funds will be released to you once the customer confirms delivery.</p>
      
      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View Order to Fulfill', `${this.baseUrl}/vendor/orders/${order_id}`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: 'Order Payment Funded',
      html,
    });
  }

  /* ------------------------------------------------------------
       5. ESCROW RELEASED (VENDOR PAID)
  ------------------------------------------------------------ */
  async sendEscrowReleasedVendor({
    email,
    name,
    order_id,
    amount,
  }: {
    email: string;
    name: string;
    order_id: string;
    amount: number;
  }) {
    const title = 'Payment Released! 💰';
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>Congratulations! Your payment for order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been released from escrow.</p>
      
      <div style="background-color: #ecfdf5; border: 1px solid #10b981; padding: 30px; border-radius: 12px; margin: 30px 0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #047857; text-transform: uppercase; letter-spacing: 1px;">Amount Added to Wallet</p>
        <p style="margin: 10px 0 0; font-size: 36px; font-weight: 800; color: #065f46;">₦${amount.toLocaleString()}</p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Go to my Wallet', `${this.baseUrl}/vendor/wallet`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: 'Your Earnings have been Released!',
      html,
    });
  }

  /* ------------------------------------------------------------
       6. ESCROW REFUNDED (BUYER)
  ------------------------------------------------------------ */
  async sendEscrowRefundedBuyer({
    email,
    name,
    order_id,
    amount,
  }: {
    email: string;
    name: string;
    order_id: string;
    amount: number;
  }) {
    const title = 'Refund Processed Successfuly';
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been cancelled and a refund has been issued.</p>
      
      <div style="background-color: #fff1f2; border: 1px solid #fecdd3; padding: 30px; border-radius: 12px; margin: 30px 0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #be123c; text-transform: uppercase; letter-spacing: 1px;">Refunded Amount</p>
        <p style="margin: 10px 0 0; font-size: 36px; font-weight: 800; color: #9f1239;">₦${amount.toLocaleString()}</p>
      </div>

      <p style="text-align: center; color: #4b5563; font-size: 14px;">
        The funds have been returned to your original payment method. Depending on your bank, it may take 3-5 business days to reflect in your account.
      </p>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: 'Refund Processed for Your Order',
      html,
    });
  }
}
