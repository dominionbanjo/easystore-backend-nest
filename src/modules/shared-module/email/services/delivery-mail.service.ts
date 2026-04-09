import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

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

  /* ----------------------------------------------------
     1) DELIVERY CREATED
  ---------------------------------------------------- */

  async sendDeliveryCreatedBuyer({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const title = 'Delivery Started! 🚚';
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been processed for delivery. Our team is working to get it to you as soon as possible.</p>
      
      <div style="background-color: #f3f4f6; padding: 25px; border-radius: 12px; margin: 30px 0; border-left: 4px solid ${this.brandColor};">
        <p style="margin: 0; font-weight: 700; color: #111827;">Status: Processing</p>
        <p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">We will notify you once your package is on the way!</p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Track Order', `${this.baseUrl}/orders/${order_id}`)}
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
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const title = 'Delivery Initialized';
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>A new delivery has been initialized for order <b>#${order_id.split('-')[0].toUpperCase()}</b>.</p>
      <p>Please ensure the package is properly packed and ready for pickup. Our courier will be arriving shortly.</p>
      
      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View Order Details', `${this.baseUrl}/vendor/orders/${order_id}`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `New Delivery: Order #${order_id.split('-')[0].toUpperCase()}`,
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
      
      <div style="background-color: #f0f7ff; border: 1px solid #dbeafe; padding: 25px; border-radius: 12px; margin: 30px 0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #1e40af; text-transform: uppercase; letter-spacing: 1px;">Courier Tracking ID</p>
        <p style="margin: 10px 0 0; font-size: 24px; font-weight: 800; color: #1e3a8a;">${courier_id.split('-')[0].toUpperCase()}</p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Track Live Progress', `${this.baseUrl}/orders/${order_id}`)}
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
  }: {
    email: string;
    name: string;
    order_id: string;
    status: string;
  }) {
    const { title, message, color } = this.getStatusMessage(status);

    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>There's an update regarding your order <b>#${order_id.split('-')[0].toUpperCase()}</b>:</p>
      
      <div style="margin: 30px 0; text-align: center;">
        <div style="display: inline-block; padding: 12px 30px; border-radius: 50px; background-color: ${color}15; color: ${color}; border: 1px solid ${color}30;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase;">${status.replace('_', ' ')}</h2>
        </div>
        <p style="margin-top: 20px; font-size: 16px; color: #4b5563;">${message}</p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View Detailed Tracking', `${this.baseUrl}/orders/${order_id}`)}
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
      
      <div style="margin: 25px 0; padding: 20px; border-radius: 12px; background-color: ${color}10; border-left: 5px solid ${color};">
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
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const title = 'Your Package has Arrived! 🎁';
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
        <p style="font-size: 18px; color: #111827;">Your order <b>#${order_id.split('-')[0].toUpperCase()}</b> has been delivered.</p>
      </div>
      
      <p style="text-align: center; color: #4b5563;">
        We hope you love your purchase! Please log in to confirm receipt and share your experience.
      </p>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Confirm Delivery Receipt', `${this.baseUrl}/orders/${order_id}`)}
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
      <div style="background-color: #fefce8; border: 1px solid #fef08a; padding: 20px; border-radius: 12px; margin-top: 25px;">
        <p style="margin: 0; color: #854d0e; font-size: 14px;">
          <b>Fulfillment Tip:</b> We are now waiting for the customer to confirm receipt. Once confirmed, your funds will be released from escrow immediately.
        </p>
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
      
      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0;">
        <h3 style="margin: 0; color: ${this.brandColor};">Thank you for shopping!</h3>
        <p style="margin-top: 10px; font-size: 14px; color: #6b7280;">We look forward to serving you again soon.</p>
      </div>

      <div style="text-align: center;">
        ${this.tpl.button('Visit the Marketplace', `${this.baseUrl}/explore`)}
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
      <div style="padding: 30px; background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 12px; text-align: center; margin: 30px 0;">
        <div style="font-size: 50px; margin-bottom: 15px;">💵</div>
        <h3 style="margin: 0; color: #047857; font-size: 24px;">Success!</h3>
        <p style="margin-top: 10px; color: #065f46; font-size: 16px;">
          The customer has confirmed delivery for order <b>#${order_id.split('-')[0].toUpperCase()}</b>.
        </p>
      </div>
      <p style="text-align: center; color: #4b5563;">
        The funds have been released from escrow and are now available in your vendor wallet.
      </p>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('View Wallet Balance', `${this.baseUrl}/vendor/wallet`)}
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
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 16px; display: inline-block; min-width: 240px; margin-top: 15px; border: 3px dashed #cbd5e1;">
          <span style="font-size: 42px; font-family: 'Courier New', monospace; font-weight: 800; letter-spacing: 12px; color: #1e293b;">${release_code}</span>
        </div>
        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; padding: 15px; border-radius: 8px; margin-top: 30px;">
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
        ${this.tpl.button('View Proof of Delivery', `${this.baseUrl}/orders/${order_id}`)}
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
