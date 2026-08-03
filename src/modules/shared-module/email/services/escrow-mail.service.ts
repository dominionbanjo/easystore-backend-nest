import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

interface OrderItem {
  name?: string;
  price?: number;
  quantity?: number;
  image?: string;
  variant?: string;
}

@Injectable()
export class EscrowMailService {
  private readonly brandColor: string;
  private readonly baseUrl =
    process.env.FRONTEND_URL || 'https://eazystore.com.ng';

  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {
    this.brandColor = this.tpl.brandColor;
  }

  private renderOrderItems(items: OrderItem[]): string {
    if (!items || items.length === 0) return '';
    const rows = items
      .map((item) => {
        const price = ((item.price ?? 0) / 100).toLocaleString('en-NG', {
          minimumFractionDigits: 2,
        });
        const lineTotal = (
          ((item.price ?? 0) * (item.quantity ?? 1)) /
          100
        ).toLocaleString('en-NG', { minimumFractionDigits: 2 });
        const imageHtml = item.image
          ? `<img src="${item.image}" alt="${item.name}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;" />`
          : `<div style="width:56px;height:56px;background:#f3f4f6;border-radius:6px;font-size:22px;display:flex;align-items:center;justify-content:center;">📦</div>`;
        return `<tr>
        <td style="padding:12px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle;">${imageHtml}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
          <p style="margin:0;font-weight:700;font-size:14px;color:#111827;">${item.name ?? 'Product'}</p>
          ${item.variant ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${item.variant}</p>` : ''}
          <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">Qty: ${item.quantity ?? 1}</p>
        </td>
        <td style="padding:12px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle;text-align:right;">
          <p style="margin:0;font-size:13px;color:#6b7280;">₦${price} × ${item.quantity ?? 1}</p>
          <p style="margin:4px 0 0;font-weight:800;font-size:14px;color:#111827;">₦${lineTotal}</p>
        </td>
      </tr>`;
      })
      .join('');
    return `<div style="margin:25px 0;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Items Ordered</p>
      <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #f3f4f6;border-radius:${this.tpl.borderRadius};">
        <thead><tr style="background:#f9fafb;">
          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#6b7280;width:72px;">Image</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#6b7280;">Item</th>
          <th style="padding:10px 8px;text-align:right;font-size:11px;color:#6b7280;">Price</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

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
      
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 25px; border-radius: ${this.tpl.borderRadius}; margin: 30px 0; text-align: center;">
        <div style="font-size: 40px; margin-bottom: 10px;">🛡️</div>
        <h3 style="margin: 0; color: #166534;">Your Purchase is Protected</h3>
        <p style="margin-top: 10px; font-size: 14px; color: #166534;">
          Your money is safely held by EazyStore and will only be released to the vendor after you confirm you've received your order.
        </p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View Order Status', `${this.baseUrl}/account/orders/${order_id}`)}
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
      
      <div style="background-color: #f3f4f6; padding: 25px; border-radius: ${this.tpl.borderRadius}; margin: 30px 0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Pending Payout</p>
        <p style="margin: 10px 0 0; font-size: 32px; font-weight: 800; color: #111827;">₦${amount.toLocaleString()}</p>
      </div>

      <p style="text-align: center; color: #4b5563;">
        You will receive these funds in your wallet immediately after the customer confirms delivery.
      </p>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Process Order', `${this.baseUrl}/vendor/orders`)}
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
    order_items = [],
    total_amount,
  }: {
    email: string;
    name: string;
    order_id: string;
    order_items?: OrderItem[];
    total_amount?: number;
  }) {
    const title = 'Escrow Funded Successfully';
    const amountDisplay = total_amount
      ? `₦${(total_amount / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
      : null;
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your payment for order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been successfully secured in escrow.</p>
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: ${this.tpl.borderRadius}; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; color: #166534;">
          🛡️ <b>Your money is protected.</b> Funds will only be released to the vendor after you confirm you've received your items.
        </p>
        ${amountDisplay ? `<p style="margin:10px 0 0;font-size:22px;font-weight:800;color:#065f46;">Total Secured: ${amountDisplay}</p>` : ''}
      </div>
      ${this.renderOrderItems(order_items)}
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: ${this.tpl.borderRadius}; margin-top: 20px;">
        <p style="margin: 0; font-size: 14px; color: #475569;">
          <b>Note:</b> The vendor has been notified and will begin processing your delivery shortly.
        </p>
      </div>
      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View Order Status', `${this.baseUrl}/account/orders/${order_id}`)}
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
    order_items = [],
    buyer_name,
    amount,
  }: {
    email: string;
    name: string;
    order_id: string;
    order_items?: OrderItem[];
    buyer_name?: string;
    amount?: number;
  }) {
    const title = 'Payment Confirmed — Fulfill This Order 🛒';
    const amountDisplay = amount
      ? `₦${(amount / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
      : null;
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>Payment for order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been funded and is securely held in escrow${buyer_name ? ` by <b>${buyer_name}</b>` : ''}.</p>
      ${amountDisplay ? `<div style="background:#ecfdf5;border:1px solid #6ee7b7;padding:20px;border-radius:${this.tpl.borderRadius};margin:20px 0;text-align:center;"><p style="margin:0;font-size:12px;color:#047857;text-transform:uppercase;letter-spacing:1px;">Amount in Escrow</p><p style="margin:8px 0 0;font-size:28px;font-weight:800;color:#065f46;">${amountDisplay}</p></div>` : ''}
      ${this.renderOrderItems(order_items)}
      <div style="background:#fefce8;border:1px solid #fef08a;padding:16px;border-radius:${this.tpl.borderRadius};margin:20px 0;">
        <p style="margin:0;color:#854d0e;font-size:14px;">
          <b>Action Required:</b> Please package and deliver the items above to the buyer. Funds will be released to you once the customer confirms delivery.
        </p>
      </div>
      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View Order to Fulfill', `${this.baseUrl}/vendor/orders`)}
      </div>
    `;
    const html = this.tpl.wrapper(title, content);
    return this.email.sendEmail({
      to: email,
      subject: `New Order Payment Secured: #${order_id.split('-')[0].toUpperCase()}`,
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
      
      <div style="background-color: #ecfdf5; border: 1px solid #10b981; padding: 30px; border-radius: ${this.tpl.borderRadius}; margin: 30px 0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #047857; text-transform: uppercase; letter-spacing: 1px;">Amount Added to Wallet</p>
        <p style="margin: 10px 0 0; font-size: 36px; font-weight: 800; color: #065f46;">₦${(amount / 100).toLocaleString()}</p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Go to my Dashboard', `${this.baseUrl}/vendor`)}
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
      
      <div style="background-color: #fff1f2; border: 1px solid #fecdd3; padding: 30px; border-radius: ${this.tpl.borderRadius}; margin: 30px 0; text-align: center;">
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

  /* ------------------------------------------------------------
       7. ESCROW RELEASE — ADMIN NOTIFICATION
  ------------------------------------------------------------ */
  async sendEscrowReleaseRequestAdmin({
    payout_id,
    order_id,
    vendor_name,
    vendor_bank_name,
    vendor_account_number,
    vendor_account_name,
    amount_kobo,
  }: {
    payout_id: string;
    order_id: string;
    vendor_name: string;
    vendor_bank_name: string;
    vendor_account_number: string;
    vendor_account_name: string;
    amount_kobo: number;
  }) {
    const amountNaira = (amount_kobo / 100).toLocaleString('en-NG', {
      style: 'currency',
      currency: 'NGN',
    });
    const orderRef = order_id.split('-')[0].toUpperCase();
    const adminPanelUrl = `${this.baseUrl}/admin`;

    const title = '💸 Escrow Release — Transfer Required';
    const content = `
      <p>A buyer has released their escrow. <b>You must now manually transfer funds to the vendor.</b></p>

      <div style="background-color: #fffbeb; border: 2px solid #f59e0b; padding: 25px; border-radius: ${this.tpl.borderRadius}; margin: 30px 0;">
        <h3 style="margin-top: 0; color: #92400e; font-size: 16px;">⚡ Action Required</h3>
        <table style="width: 100%; border-spacing: 0;">
          <tr>
            <td style="padding: 8px 0; color: #b45309; font-size: 14px; width: 140px;">Order</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 700; font-size: 14px;">#${orderRef}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #b45309; font-size: 14px;">Payout ID</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 13px; font-family: monospace;">${payout_id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #b45309; font-size: 14px;">Vendor</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 700; font-size: 14px;">${vendor_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #b45309; font-size: 14px;">Bank</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 14px;">${vendor_bank_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #b45309; font-size: 14px;">Account No.</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 700; font-size: 16px; letter-spacing: 2px;">${vendor_account_number}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #b45309; font-size: 14px;">Account Name</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 14px;">${vendor_account_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #b45309; font-size: 14px;">Amount</td>
            <td style="padding: 8px 0; color: #065f46; font-weight: 800; font-size: 20px;">${amountNaira}</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 14px; color: #4b5563;">After transferring, go to the admin dashboard and mark this payout as transferred.</p>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Go to Admin Dashboard → Payouts', `${adminPanelUrl}/payouts`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);
    return this.email.sendEmail({
      to: 'dominionbanjo@gmail.com',
      subject: `[ACTION REQUIRED] Transfer ${amountNaira} to ${vendor_name} — Order #${orderRef}`,
      html,
    });
  }

  /* ------------------------------------------------------------
       8. VENDOR — PAYMENT INCOMING (after escrow release)
  ------------------------------------------------------------ */
  async sendPaymentIncomingVendor({
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
    const title = 'Payment Is On Its Way! 🚀';
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>The buyer has confirmed delivery for order <b>#${order_id.split('-')[0].toUpperCase()}</b>. Your payment of <b>₦${(amount / 100).toLocaleString()}</b> is being processed and will be transferred to your bank account shortly.</p>

      <div style="background-color: #ecfdf5; border: 1px solid #6ee7b7; padding: 25px; border-radius: ${this.tpl.borderRadius}; margin: 30px 0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #047857; text-transform: uppercase; letter-spacing: 1px;">Amount Incoming</p>
        <p style="margin: 10px 0 0; font-size: 36px; font-weight: 800; color: #065f46;">₦${(amount / 100).toLocaleString()}</p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View Order', `${this.baseUrl}/vendor/orders`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);
    return this.email.sendEmail({
      to: email,
      subject: `Payment Incoming: Order #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  /* ------------------------------------------------------------
       9. VENDOR — PAYMENT CONFIRMED (admin marked as transferred)
  ------------------------------------------------------------ */
  async sendPaymentConfirmedVendor({
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
    const title = 'Payment Sent to Your Account! 💰';
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>Your payment for order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been transferred to your bank account.</p>

      <div style="background-color: #ecfdf5; border: 1px solid #10b981; padding: 30px; border-radius: ${this.tpl.borderRadius}; margin: 30px 0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #047857; text-transform: uppercase; letter-spacing: 1px;">Amount Transferred</p>
        <p style="margin: 10px 0 0; font-size: 36px; font-weight: 800; color: #065f46;">₦${(amount / 100).toLocaleString()}</p>
      </div>

      <p style="text-align: center; color: #4b5563; font-size: 14px;">Please allow 1-3 business days for the funds to reflect depending on your bank.</p>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Go to Dashboard', `${this.baseUrl}/vendor`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);
    return this.email.sendEmail({
      to: email,
      subject: `Payment Confirmed: Order #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }
}
