import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';
import { ICartItem } from 'src/modules/commerce-module/cart/types/types';

interface OrderMailPayload {
  email: string;
  name: string;
  order: {
    id: string;
    status: string;
    total: number;
    items?: ICartItem[];
    shipping_fee?: number;
    subtotal?: number;
  };
}

@Injectable()
export class OrderMailService {
  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {}

  private renderItemTable(items: ICartItem[]) {
    if (!items || items.length === 0) return '';

    const rows = items
      .map(
        (item) => `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 0;">
          <div style="display: flex; align-items: center;">
            ${
              item.image
                ? `<img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover; margin-right: 12px;" />`
                : ''
            }
            <div>
              <p style="margin: 0; font-weight: 600; font-size: 14px;">${item.name}</p>
              ${
                item.color || item.size
                  ? `<p style="margin: 0; font-size: 12px; color: #6b7280;">${item.color ? `Color: ${item.color}` : ''} ${item.size ? `| Size: ${item.size}` : ''}</p>`
                  : ''
              }
            </div>
          </div>
        </td>
        <td style="padding: 12px 0; text-align: center; font-size: 14px; color: #6b7280;">x${item.quantity}</td>
        <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 14px;">₦${(item.unit_price / 100).toLocaleString()}</td>
      </tr>
    `,
      )
      .join('');

    return `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="border-bottom: 2px solid #f3f4f6;">
            <th style="padding: 12px 0; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Product</th>
            <th style="padding: 12px 0; text-align: center; font-size: 12px; color: #6b7280; text-transform: uppercase;">Qty</th>
            <th style="padding: 12px 0; text-align: right; font-size: 12px; color: #6b7280; text-transform: uppercase;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  private renderOrderSummary(payload: OrderMailPayload) {
    const { order } = payload;
    const subtotal = order.subtotal || order.total * 100;
    const shipping = order.shipping_fee || 0;

    return `
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280;">Subtotal</span>
          <span style="font-weight: 600;">₦${(subtotal / 100).toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280;">Shipping</span>
          <span style="font-weight: 600;">₦${(shipping / 100).toLocaleString()}</span>
        </div>
        <div style="border-top: 1px solid #e5e7eb; margin: 12px 0; padding-top: 12px; display: flex; justify-content: space-between;">
          <span style="font-weight: 700; color: #111827; font-size: 18px;">Total</span>
          <span style="font-weight: 700; color: #6366f1; font-size: 18px;">₦${order.total.toLocaleString()}</span>
        </div>
      </div>
    `;
  }

  async sendOrderCreated(payload: OrderMailPayload) {
    const itemTable = this.renderItemTable(payload.order.items || []);
    const summary = this.renderOrderSummary(payload);

    const html = this.tpl.wrapper(
      'Order Confirmed! 📦',
      `
        <p>Hi <b>${payload.name}</b>,</p>
        <p>Thank you for your purchase! Your order <b>#${payload.order.id.split('-')[0].toUpperCase()}</b> has been received and is being processed.</p>
        
        <h3 style="margin-top: 30px;">Order Summary</h3>
        ${itemTable}
        ${summary}

        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('View Order Details', `${process.env.FRONTEND_URL}/orders/${payload.order.id}`)}
        </div>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: `Order Confirmed: #${payload.order.id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  async sendVendorNewOrder(payload: OrderMailPayload) {
    const itemTable = this.renderItemTable(payload.order.items || []);
    const summary = this.renderOrderSummary(payload);

    const html = this.tpl.wrapper(
      'New Order Received! 🚀',
      `
        <p>Hello <b>${payload.name}</b>,</p>
        <p>You have received a new order <b>#${payload.order.id.split('-')[0].toUpperCase()}</b>.</p>
        
        <h3 style="margin-top: 30px;">Order Details</h3>
        ${itemTable}
        ${summary}

        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Manage Order', `${process.env.FRONTEND_URL}/vendor/orders/${payload.order.id}`)}
        </div>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: `New Order Alert: #${payload.order.id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  async sendPaymentInitialized(payload: OrderMailPayload) {
    const html = this.tpl.wrapper(
      'Payment Initialized',
      `
        <p>Hi <b>${payload.name}</b>,</p>
        <p>Your payment process for order <b>#${payload.order.id.split('-')[0].toUpperCase()}</b> has been started. Please complete the payment to finalize your order.</p>
        
        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Complete Payment', `${process.env.FRONTEND_URL}/orders/${payload.order.id}/pay`)}
        </div>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: 'Payment Required for Your Order',
      html,
    });
  }

  async sendPaymentVerified(payload: OrderMailPayload, receiptPdf?: Buffer) {
    const itemTable = this.renderItemTable(payload.order.items || []);
    const summary = this.renderOrderSummary(payload);

    const html = this.tpl.wrapper(
      'Payment Successful! ✅',
      `
        <p>Hi <b>${payload.name}</b>,</p>
        <p>Great news! Your payment for order <b>#${payload.order.id.split('-')[0].toUpperCase()}</b> was successfully confirmed. We've now preparing your items for delivery.</p>
        
        <p>We've attached your official digital receipt to this email for your records. You can also download it anytime from your order history on EazyStore.</p>

        <h3 style="margin-top: 30px;">Receipt Summary</h3>
        ${itemTable}
        ${summary}

        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Track Delivery', `${process.env.FRONTEND_URL}/orders/${payload.order.id}`)}
        </div>
      `,
    );

    const attachments = receiptPdf
      ? [
          {
            content: receiptPdf.toString('base64'),
            name: `receipt-${payload.order.id.split('-')[0].toUpperCase()}.pdf`,
          },
        ]
      : undefined;

    return this.email.sendEmail({
      to: payload.email,
      subject: `Payment Confirmed: Order #${payload.order.id.split('-')[0].toUpperCase()}`,
      html,
      attachments,
    });
  }

  async sendVendorPaymentVerified(payload: OrderMailPayload) {
    const itemTable = this.renderItemTable(payload.order.items || []);
    const summary = this.renderOrderSummary(payload);

    const html = this.tpl.wrapper(
      'Payment Confirmed! 💰',
      `
        <p>Hello <b>${payload.name}</b>,</p>
        <p>Payment for order <b>#${payload.order.id.split('-')[0].toUpperCase()}</b> has been confirmed. You can now proceed with fulfilling the order.</p>
        
        <h3 style="margin-top: 30px;">Order Details</h3>
        ${itemTable}
        ${summary}

        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Fulfill Order', `${process.env.FRONTEND_URL}/vendor/orders/${payload.order.id}`)}
        </div>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: `Order Payment Confirmed: #${payload.order.id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  async sendOrderStatusUpdate(payload: OrderMailPayload & { status: string }) {
    const html = this.tpl.wrapper(
      'Order Status Update',
      `
        <p>Hi <b>${payload.name}</b>,</p>
        <p>Your order <b>#${payload.order.id.split('-')[0].toUpperCase()}</b> status has been updated to:</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="font-weight: 700; font-size: 20px; color: #6366f1; text-transform: uppercase;">${payload.status.replace(/_/g, ' ')}</span>
        </div>

        <p>You can track the progress of your order using the link below.</p>

        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Track Order', `${process.env.FRONTEND_URL}/orders/${payload.order.id}`)}
        </div>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: `Order Update: #${payload.order.id.split('-')[0].toUpperCase()} is now ${payload.status.toUpperCase()}`,
      html,
    });
  }

  async sendOrderCanceled(payload: OrderMailPayload) {
    const html = this.tpl.wrapper(
      'Order Cancelled',
      `
        <p>Hi <b>${payload.name}</b>,</p>
        <p>The order <b>#${payload.order.id.split('-')[0].toUpperCase()}</b> has been cancelled.</p>
        
        <p style="color: #6b7280;">If you didn't request this or have any concerns, please contact our support team.</p>

        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('View Order', `${process.env.FRONTEND_URL}/orders/${payload.order.id}`)}
        </div>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: `Order Cancelled: #${payload.order.id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  /* ────────────────────────────────────────────────
     STALE ORDER (PAYMENT TIMEOUT) EMAILS
  ──────────────────────────────────────────────── */

  async sendOrderFailedPaymentTimeout(payload: OrderMailPayload) {
    const html = this.tpl.wrapper(
      'Order Payment Timeout ⌛',
      `
        <p>Hi <b>${payload.name}</b>,</p>
        <p>Your order <b>#${payload.order.id.split('-')[0].toUpperCase()}</b> has been cancelled because the payment was not completed within the required 24-hour window.</p>
        
        <p style="color: #ef4444; font-weight: 600;">Status: EXPIRED</p>

        <p>If you still wish to purchase these items, please start a new order on EasyStore.</p>

        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Start New Order', `${process.env.FRONTEND_URL}/`)}
        </div>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: `Order Expired: #${payload.order.id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  async sendVendorOrderFailedPaymentTimeout(payload: OrderMailPayload & { vendorName: string; storeName: string }) {
    const html = this.tpl.wrapper(
      'Order Expired (Payment Timeout)',
      `
        <p>Hello <b>${payload.vendorName}</b>,</p>
        <p>Order <b>#${payload.order.id.split('-')[0].toUpperCase()}</b> from <b>${payload.storeName}</b> has been automatically cancelled as the buyer did not complete the payment within 24 hours.</p>
        
        <p>Any items reserved for this order have been released back into your inventory.</p>

        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Manage Dashboard', `${process.env.FRONTEND_URL}/vendor`)}
        </div>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: `Unpaid Order Cancelled: #${payload.order.id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  /* ────────────────────────────────────────────────
     POST-PURCHASE (RATE PRODUCT/VENDOR) EMAILS
  ──────────────────────────────────────────────── */

  async sendRateVendorEmail(payload: { email: string; name: string; storeName: string; orderId: string; products: ICartItem[] }) {
    const html = this.tpl.wrapper(
      `How was your order from ${payload.storeName}? ⭐️`,
      `
        <p>Hi <b>${payload.name}</b>,</p>
        <p>Your order <b>#${payload.orderId.split('-')[0].toUpperCase()}</b> from <b>${payload.storeName}</b> has been delivered! We hope you love your new items.</p>
        
        <p>Your feedback is incredibly valuable to other shoppers and helps our vendors grow. Could you take a moment to leave a review?</p>

        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Leave a Review', `${process.env.FRONTEND_URL}/orders/${payload.orderId}`)}
        </div>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: `Rate your recent purchase from ${payload.storeName}!`,
      html,
    });
  }
}
