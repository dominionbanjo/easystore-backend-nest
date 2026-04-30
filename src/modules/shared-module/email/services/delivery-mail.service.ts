import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

interface OrderItem {
  name?: string;
  price?: number;
  quantity?: number;
  image?: string;
  slug?: string;
  variant?: string;
}

interface BuyerDetails {
  name: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
}

@Injectable()
export class DeliveryMailService {
  private readonly brandColor: string;
  private readonly baseUrl = process.env.FRONTEND_URL || 'https://eazystore.com.ng';

  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {
    this.brandColor = this.tpl.brandColor;
  }

  private getStatusMessage(status: string): {
    title: string;
    message: string;
    color: string;
  } {
    const s = status.toLowerCase();
    switch (s) {
      case 'pending':
        return {
          title: 'Order Pending',
          message: 'Your order is currently pending processing.',
          color: '#f59e0b',
        };
      case 'assigned':
        return {
          title: 'Courier Assigned',
          message: 'A delivery courier has been assigned to your order.',
          color: '#3b82f6',
        };
      case 'in_transit':
        return {
          title: 'Order In Transit',
          message: 'Good news! Your order is on its way to you.',
          color: '#8b5cf6',
        };
      case 'delivered':
        return {
          title: 'Order Delivered',
          message: 'Your package has been delivered successfully.',
          color: '#10b981',
        };
      case 'failed':
        return {
          title: 'Delivery Attempt Failed',
          message: 'We attempted to deliver your package but were unsuccessful.',
          color: '#ef4444',
        };
      case 'returned':
        return {
          title: 'Order Returned',
          message: 'Your order has been marked as returned.',
          color: '#f97316',
        };
      default:
        return {
          title: 'Status Updated',
          message: `Your delivery status has been updated to: ${status}`,
          color: '#6b7280',
        };
    }
  }

  /** Renders an HTML table of order items with images */
  private renderOrderItems(items: OrderItem[]): string {
    if (!items || items.length === 0) return '';

    const rows = items
      .map((item) => {
        const price = ((item.price ?? 0) / 100).toLocaleString('en-NG', {
          minimumFractionDigits: 2,
        });
        const lineTotal = (((item.price ?? 0) * (item.quantity ?? 1)) / 100).toLocaleString('en-NG', {
          minimumFractionDigits: 2,
        });
        const imageHtml = item.image
          ? `<img src="${item.image}" alt="${item.name}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;" />`
          : `<div style="width:56px;height:56px;background:#f3f4f6;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:22px;">📦</div>`;

        return `
          <tr>
            <td style="padding:12px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
              ${imageHtml}
            </td>
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

    return `
      <div style="margin:25px 0;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Order Items</p>
        <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #f3f4f6;border-radius:${this.tpl.borderRadius};overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;width:72px;">Image</th>
              <th style="padding:10px 8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Item</th>
              <th style="padding:10px 8px;text-align:right;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Price</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  /** Renders a buyer info block for vendor emails */
  private renderBuyerDetails(buyer: BuyerDetails): string {
    const addr = [buyer.address, buyer.city, buyer.state].filter(Boolean).join(', ');
    return `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:${this.tpl.borderRadius};padding:20px;margin:20px 0;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Buyer Details</p>
        <p style="margin:0;font-weight:700;color:#111827;font-size:14px;">${buyer.name}</p>
        <p style="margin:2px 0 0;font-size:13px;color:#4b5563;">${buyer.email}</p>
        ${addr ? `<p style="margin:4px 0 0;font-size:13px;color:#4b5563;">📍 ${addr}</p>` : ''}
      </div>`;
  }

  /* ----------------------------------------------------
     1) DELIVERY CREATED
  ---------------------------------------------------- */

  async sendDeliveryCreatedBuyer({
    email,
    name,
    order_id,
    order_items = [],
  }: {
    email: string;
    name: string;
    order_id: string;
    order_items?: OrderItem[];
  }) {
    const title = 'Delivery Started! 🚚';
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been processed for delivery. The vendor is now preparing your items and will dispatch them shortly.</p>
      
      <div style="background-color: #f3f4f6; padding: 25px; border-radius: ${this.tpl.borderRadius}; margin: 30px 0; border-left: 4px solid ${this.brandColor};">
        <p style="margin: 0; font-weight: 700; color: #111827;">Status: Processing for Delivery</p>
        <p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">We will notify you once your package is on the way!</p>
      </div>

      ${this.renderOrderItems(order_items)}

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Track Order', `${this.baseUrl}/account/orders/${order_id}`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Delivery Started: Order #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  async sendDeliveryCreatedVendor({
    email,
    name,
    order_id,
    order_items = [],
    buyer,
  }: {
    email: string;
    name: string;
    order_id: string;
    order_items?: OrderItem[];
    buyer?: BuyerDetails;
  }) {
    const title = 'New Order to Fulfill 📦';
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>A new order <b>#${order_id.split('-')[0].toUpperCase()}</b> requires fulfillment. As you handle your own deliveries, please package the items below and deliver them to the buyer as soon as possible.</p>
      
      ${buyer ? this.renderBuyerDetails(buyer) : ''}
      ${this.renderOrderItems(order_items)}

      <div style="background:#fefce8;border:1px solid #fef08a;padding:16px;border-radius:${this.tpl.borderRadius};margin:20px 0;">
        <p style="margin:0;color:#854d0e;font-size:14px;">
          <b>Reminder:</b> You are responsible for packaging and delivering this order directly to the buyer. Funds will be released from escrow once the buyer confirms receipt.
        </p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View Order Details', `${this.baseUrl}/vendor/orders`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `New Order to Fulfill: #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  /* ----------------------------------------------------
     2) COURIER ASSIGNED
  ---------------------------------------------------- */

  async sendCourierAssignedBuyer({
    email,
    name,
    order_id,
    courier_id,
  }: {
    email: string;
    name: string;
    order_id: string;
    courier_id: string;
  }) {
    const title = 'Courier Assigned 🛵';
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>A courier has been assigned to your order <b>#${order_id.split('-')[0].toUpperCase()}</b> and is preparing for pickup.</p>
      
      <div style="background-color: #f0f7ff; border: 1px solid #dbeafe; padding: 25px; border-radius: ${this.tpl.borderRadius}; margin: 30px 0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #1e40af; text-transform: uppercase; letter-spacing: 1px;">Courier Tracking ID</p>
        <p style="margin: 10px 0 0; font-size: 24px; font-weight: 800; color: #1e3a8a;">${courier_id.split('-')[0].toUpperCase()}</p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Track Live Progress', `${this.baseUrl}/account/orders/${order_id}`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: 'A Courier is Picking Up Your Order',
      html,
    });
  }

  async sendCourierAssignedVendor({
    email,
    name,
    order_id,
    courier_id,
  }: {
    email: string;
    name: string;
    order_id: string;
    courier_id: string;
  }) {
    const title = 'Courier Assigned';
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>Courier <b>${courier_id.split('-')[0].toUpperCase()}</b> has been assigned to pickup order <b>#${order_id.split('-')[0].toUpperCase()}</b>.</p>
      <p>Please have the package ready for the courier. They will be at your location soon.</p>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Courier Assigned: Order #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  /* ----------------------------------------------------
     3) DELIVERY STATUS UPDATED
  ---------------------------------------------------- */

  async sendDeliveryStatusUpdateBuyer({
    email,
    name,
    order_id,
    status,
    order_items = [],
  }: {
    email: string;
    name: string;
    order_id: string;
    status: string;
    order_items?: OrderItem[];
  }) {
    const { title, message, color } = this.getStatusMessage(status);

    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>There's an update regarding your order <b>#${order_id.split('-')[0].toUpperCase()}</b>:</p>
      
      <div style="margin: 30px 0; text-align: center;">
        <div style="display: inline-block; padding: 12px 30px; border-radius: ${this.tpl.borderRadius}; background-color: ${color}15; color: ${color}; border: 1px solid ${color}30;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase;">${status.replace('_', ' ')}</h2>
        </div>
        <p style="margin-top: 20px; font-size: 16px; color: #4b5563;">${message}</p>
      </div>

      ${this.renderOrderItems(order_items)}

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View Detailed Tracking', `${this.baseUrl}/account/orders/${order_id}`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Order Update: ${title}`,
      html,
    });
  }

  async sendDeliveryStatusUpdateVendor({
    email,
    name,
    order_id,
    status,
  }: {
    email: string;
    name: string;
    order_id: string;
    status: string;
  }) {
    const { title, color } = this.getStatusMessage(status);

    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>The delivery status for order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been updated.</p>
      
      <div style="margin: 25px 0; padding: 20px; border-radius: ${this.tpl.borderRadius}; background-color: ${color}10; border-left: 5px solid ${color};">
        <p style="margin: 0; font-weight: 700; color: #111827; text-transform: capitalize;">New Status: ${status.replace('_', ' ')}</p>
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Status Update: Order #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  /* ----------------------------------------------------
     4) DELIVERY MARKED DELIVERED
  ---------------------------------------------------- */

  async sendDeliveryDeliveredBuyer({
    email,
    name,
    order_id,
    order_items = [],
  }: {
    email: string;
    name: string;
    order_id: string;
    order_items?: OrderItem[];
  }) {
    const title = 'Your Package has Arrived! 🎁';
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
        <p style="font-size: 18px; color: #111827;">Your order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been delivered.</p>
      </div>
      
      ${this.renderOrderItems(order_items)}

      <p style="text-align: center; color: #4b5563;">
        We hope you love your purchase! Please log in to confirm receipt and share your experience.
      </p>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Confirm Delivery Receipt', `${this.baseUrl}/account/orders/${order_id}`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Delivered: Order #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  async sendDeliveryDeliveredVendor({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const title = 'Delivery Completed';
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>Order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been marked as delivered by the courier.</p>
      <div style="background-color: #fefce8; border: 1px solid #fef08a; padding: 20px; border-radius: ${this.tpl.borderRadius}; margin-top: 25px;">
        <p style="margin: 0; color: #854d0e; font-size: 14px;">
          <b>Fulfillment Final Step:</b> Please contact the buyer to receive the <b>Delivery Confirmation Code (OTP)</b>. 
          Input this code on your dashboard to confirm receipt and release your funds from escrow immediately.
        </p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Input Confirmation Code', `${this.baseUrl}/vendor/orders`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Order Delivered: #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  /* ----------------------------------------------------
     5) DELIVERY CONFIRMED (Escrow Released)
  ---------------------------------------------------- */

  async sendDeliveryConfirmedBuyer({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const title = 'Order Completed! ✅';
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Thank you for confirming the delivery of order <b>#${order_id.split('-')[0].toUpperCase()}</b>. This completes your transaction.</p>
      
      <div style="background-color: #f3f4f6; border-radius: ${this.tpl.borderRadius}; padding: 25px; text-align: center; margin: 30px 0;">
        <h3 style="margin: 0; color: ${this.brandColor};">Thank you for shopping!</h3>
        <p style="margin-top: 10px; font-size: 14px; color: #6b7280;">We look forward to serving you again soon.</p>
      </div>

      <div style="text-align: center;">
        ${this.tpl.button('Visit the Marketplace', `${this.baseUrl}/stores`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Order Completed: #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  async sendDeliveryConfirmedVendor({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const title = 'Payment Released! 💰';
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <div style="padding: 30px; background-color: #ecfdf5; border: 1px solid #10b981; border-radius: ${this.tpl.borderRadius}; text-align: center; margin: 30px 0;">
        <div style="font-size: 50px; margin-bottom: 15px;">💵</div>
        <h3 style="margin: 0; color: #047857; font-size: 24px;">Success!</h3>
        <p style="margin-top: 10px; color: #065f46; font-size: 16px;">
          The customer has confirmed delivery for order <b>#${order_id.split('-')[0].toUpperCase()}</b>.
        </p>
      </div>
      <p style="text-align: center; color: #4b5563;">
        The funds have been released from escrow. Your payout is now <b>pending</b> and will be processed to your registered bank account shortly.
      </p>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View My Dashboard', `${this.baseUrl}/vendor`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Payment Released: Order #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  /* ----------------------------------------------------
     6) RELEASE CODE
  ---------------------------------------------------- */

  async sendReleaseCodeToBuyer({
    email,
    name,
    order_id,
    release_code,
  }: {
    email: string;
    name: string;
    order_id: string;
    release_code: string;
  }) {
    const title = 'Delivery Confirmation Code';
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your delivery for order <b>#${order_id.split('-')[0].toUpperCase()}</b> is arriving. For security, please provide the code below to the courier ONLY after you have received and inspected your package.</p>
      
      <div style="margin: 40px 0; text-align: center;">
        <p style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Secure Release Code</p>
        <div style="background-color: #f8fafc; padding: 30px; border-radius: ${this.tpl.borderRadius}; display: inline-block; min-width: 240px; margin-top: 15px; border: 3px dashed #cbd5e1;">
          <span style="font-size: 42px; font-family: 'Courier New', monospace; font-weight: 800; letter-spacing: 12px; color: #1e293b;">${release_code}</span>
        </div>
        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; padding: 15px; border-radius: ${this.tpl.borderRadius}; margin-top: 30px;">
          <p style="font-size: 13px; color: #be123c; margin: 0; font-weight: 600;">
            ⚠ Warning: Do not share this code with anyone until the package is in your hands.
          </p>
        </div>
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Delivery Code: ${release_code} for Order #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }

  async sendProofUploadedBuyer({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const title = 'Proof of Delivery Uploaded';
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>A proof of delivery (photo/document) has been uploaded for your order <b>#${order_id.split('-')[0].toUpperCase()}</b>.</p>
      <p>You can view this proof in your order details page.</p>
      
      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View Proof of Delivery', `${this.baseUrl}/account/orders/${order_id}`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Proof of Delivery: Order #${order_id.split('-')[0].toUpperCase()}`,
      html,
    });
  }
}
