import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

const LOGO_URL =
  'https://easystore01.netlify.app/logos/inline-stripe-transparent.png'; // Replace with actual logo URL

@Injectable()
export class DeliveryMailService {
  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {}

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
          color: '#eab308', // yellow
        };
      case 'assigned':
        return {
          title: 'Courier Assigned',
          message: 'A delivery courier has been assigned to your order.',
          color: '#3b82f6', // blue
        };
      case 'in_transit':
        return {
          title: 'Order In Transit',
          message: 'Good news! Your order is on its way to you.',
          color: '#8b5cf6', // purple
        };
      case 'delivered':
        return {
          title: 'Order Delivered',
          message: 'Your package has been delivered successfully.',
          color: '#22c55e', // green
        };
      case 'failed':
        return {
          title: 'Delivery Attempt Failed',
          message:
            'We attempted to deliver your package but were unsuccessful.',
          color: '#ef4444', // red
        };
      case 'returned':
        return {
          title: 'Order Returned',
          message: 'Your order has been marked as returned.',
          color: '#f97316', // orange
        };
      default:
        return {
          title: 'Status Updated',
          message: `Your delivery status has been updated to: ${status}`,
          color: '#6b7280', // gray
        };
    }
  }

  /* ----------------------------------------------------
     1) DELIVERY CREATED
  ---------------------------------------------------- */

  // Buyer
  async sendDeliveryCreatedBuyer({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const content = `
      <p style="font-size:16px; color:#374151;">Hi <b>${name}</b>,</p>
      <p style="font-size:15px; color:#4b5563; line-height:1.6;">
        Your order <b>#${order_id}</b> has been processed for delivery.
        Our team is working to get it to you as soon as possible.
      </p>
      <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <p style="margin:0; font-weight:600; color:#1f2937;">Status: Processing</p>
      </div>
      <p style="font-size:14px; color:#6b7280;">We will notify you once it's on the way!</p>
    `;

    const html = this.tpl.wrapperWithLogo(
      'Delivery Started',
      content,
      LOGO_URL,
    );

    return this.email.sendEmail({
      to: email,
      subject: `Delivery Started: Order #${order_id}`,
      html,
    });
  }

  // Vendor
  async sendDeliveryCreatedVendor({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const content = `
      <p style="font-size:16px; color:#374151;">Hello <b>${name}</b>,</p>
      <p style="font-size:15px; color:#4b5563; line-height:1.6;">
        A new delivery has been initialized for order <b>#${order_id}</b>.
      </p>
      <p style="font-size:15px; color:#4b5563;">Please ensure the package is ready for pickup.</p>
    `;

    const html = this.tpl.wrapperWithLogo(
      'Delivery Created',
      content,
      LOGO_URL,
    );

    return this.email.sendEmail({
      to: email,
      subject: `New Delivery: Order #${order_id}`,
      html,
    });
  }

  /* ----------------------------------------------------
     2) COURIER ASSIGNED
  ---------------------------------------------------- */

  // Buyer
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
    const content = `
      <p style="font-size:16px; color:#374151;">Hi <b>${name}</b>,</p>
      <p style="font-size:15px; color:#4b5563; line-height:1.6;">
        A courier has been assigned to your order <b>#${order_id}</b>.
      </p>
      <div style="margin: 20px 0; padding: 15px; background-color: #eff6ff; border-radius: 8px; border: 1px solid #dbeafe; text-align: center;">
        <p style="margin:0; font-size:14px; color:#1e40af;">Courier ID</p>
        <p style="margin:5px 0 0; font-size:18px; font-weight:bold; color:#1e3a8a;">${courier_id}</p>
      </div>
    `;

    const html = this.tpl.wrapperWithLogo(
      'Courier Assigned',
      content,
      LOGO_URL,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Courier Assigned to Your Delivery',
      html,
    });
  }

  // Vendor
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
    const content = `
      <p style="font-size:16px; color:#374151;">Hello <b>${name}</b>,</p>
      <p style="font-size:15px; color:#4b5563; line-height:1.6;">
        Courier <b>${courier_id}</b> has been assigned to pickup order <b>#${order_id}</b>.
      </p>
    `;

    const html = this.tpl.wrapperWithLogo(
      'Courier Assigned',
      content,
      LOGO_URL,
    );

    return this.email.sendEmail({
      to: email,
      subject: `Courier Assigned: Order #${order_id}`,
      html,
    });
  }

  /* ----------------------------------------------------
     3) DELIVERY STATUS UPDATED
  ---------------------------------------------------- */

  // Buyer
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
      <p style="font-size:16px; color:#374151;">Hi <b>${name}</b>,</p>
      <p style="font-size:15px; color:#4b5563;">Update regarding your order <b>#${order_id}</b>:</p>
      
      <div style="margin: 25px 0; text-align: center;">
        <div style="display: inline-block; padding: 12px 24px; border-radius: 50px; background-color: ${color}15; color: ${color}; border: 1px solid ${color}30;">
          <h2 style="margin:0; font-size: 20px; font-weight: 700; text-transform: capitalize;">${status.replace('_', ' ')}</h2>
        </div>
        <p style="margin-top: 15px; font-size: 16px; color: #1f2937;">${message}</p>
      </div>
    `;

    const html = this.tpl.wrapperWithLogo(title, content, LOGO_URL);

    return this.email.sendEmail({
      to: email,
      subject: `Order Update: ${title}`,
      html,
    });
  }

  // Vendor
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
      <p style="font-size:16px; color:#374151;">Hello <b>${name}</b>,</p>
      <p style="font-size:15px; color:#4b5563;">The delivery status for order <b>#${order_id}</b> has changed.</p>
      
      <div style="margin: 20px 0; padding: 15px; border-radius: 8px; background-color: ${color}10; border-left: 4px solid ${color};">
        <p style="margin:0; font-weight:600; color:#1f2937; text-transform: capitalize;">New Status: ${status.replace('_', ' ')}</p>
      </div>
    `;

    const html = this.tpl.wrapperWithLogo(title, content, LOGO_URL);

    return this.email.sendEmail({
      to: email,
      subject: `Status Update: Order #${order_id}`,
      html,
    });
  }

  /* ----------------------------------------------------
     4) DELIVERY MARKED DELIVERED
  ---------------------------------------------------- */

  // Buyer
  async sendDeliveryDeliveredBuyer({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const content = `
      <p style="font-size:16px; color:#374151;">Hi <b>${name}</b>,</p>
      <div style="text-align:center; margin: 30px 0;">
        <span style="font-size: 40px;">🎁</span>
        <h3 style="margin: 10px 0; color: #111827;">Your Package has Arrived!</h3>
        <p style="color: #4b5563;">Your order <b>#${order_id}</b> has been marked as delivered.</p>
      </div>
      <p style="font-size:15px; color:#4b5563; text-align:center;">
        Please log in to your EasyStore app to <b>confirm receipt</b> and rate your experience.
      </p>
      <div style="text-align:center; margin-top:20px;">
        <a href="#" style="background-color:#111827; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:600;">Confirm Delivery</a>
      </div>
    `;

    const html = this.tpl.wrapperWithLogo(
      'Package Delivered',
      content,
      LOGO_URL,
    );

    return this.email.sendEmail({
      to: email,
      subject: `Delivered: Order #${order_id}`,
      html,
    });
  }

  // Vendor
  async sendDeliveryDeliveredVendor({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const content = `
      <p style="font-size:16px; color:#374151;">Hello <b>${name}</b>,</p>
      <p style="font-size:15px; color:#4b5563;">Order <b>#${order_id}</b> has been marked as delivered by the courier.</p>
      <p style="font-size:15px; color:#4b5563;">We are waiting for the customer to confirm receipt before releasing payment.</p>
    `;

    const html = this.tpl.wrapperWithLogo(
      'Delivery Completed',
      content,
      LOGO_URL,
    );

    return this.email.sendEmail({
      to: email,
      subject: `Order Delivered: #${order_id}`,
      html,
    });
  }

  /* ----------------------------------------------------
     5) DELIVERY CONFIRMED (Escrow Released)
  ---------------------------------------------------- */

  // Buyer
  async sendDeliveryConfirmedBuyer({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const content = `
      <p style="font-size:16px; color:#374151;">Hi <b>${name}</b>,</p>
      <p style="font-size:15px; color:#4b5563;">Thank you for confirming the delivery of order <b>#${order_id}</b>.</p>
      <p style="font-size:15px; color:#4b5563;">We hope you enjoy your purchase!</p>
      <div style="text-align:center; margin-top:30px;">
        <p style="font-size:14px; color:#9ca3af;">Thank you for shopping with EasyStore.</p>
      </div>
    `;

    const html = this.tpl.wrapperWithLogo('Order Completed', content, LOGO_URL);

    return this.email.sendEmail({
      to: email,
      subject: `Order Completed: #${order_id}`,
      html,
    });
  }

  // Vendor
  async sendDeliveryConfirmedVendor({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const content = `
      <p style="font-size:16px; color:#374151;">Hello <b>${name}</b>,</p>
      <div style="padding: 20px; background-color: #ecfdf5; border: 1px solid #d1fae5; border-radius: 8px; text-align: center;">
        <h3 style="margin:0; color: #047857;">Payment Released! 💰</h3>
        <p style="margin:10px 0 0; color: #065f46;">
          The customer has confirmed delivery for order <b>#${order_id}</b>.
        </p>
      </div>
      <p style="margin-top:20px; font-size:15px; color:#4b5563;">The funds have been released from escrow to your wallet.</p>
    `;

    const html = this.tpl.wrapperWithLogo(
      'Payment Released',
      content,
      LOGO_URL,
    );

    return this.email.sendEmail({
      to: email,
      subject: `Payment Released: Order #${order_id}`,
      html,
    });
  }

  /* ----------------------------------------------------
     6) PROOF OF DELIVERY UPLOADED
  ---------------------------------------------------- */

  async sendProofUploadedBuyer({
    email,
    name,
    order_id,
  }: {
    email: string;
    name: string;
    order_id: string;
  }) {
    const content = `
      <p style="font-size:16px; color:#374151;">Hi <b>${name}</b>,</p>
      <p style="font-size:15px; color:#4b5563;">A proof of delivery has been uploaded for your order <b>#${order_id}</b>.</p>
      <div style="text-align:center; margin: 25px 0;">
        <a href="#" style="background-color:#fff; color:#111827; border: 1px solid #d1d5db; padding:10px 20px; text-decoration:none; border-radius:6px; font-weight:600;">View Proof of Delivery</a>
      </div>
    `;

    const html = this.tpl.wrapperWithLogo(
      'Proof of Delivery',
      content,
      LOGO_URL,
    );

    return this.email.sendEmail({
      to: email,
      subject: `Proof of Delivery: Order #${order_id}`,
      html,
    });
  }

  /* ----------------------------------------------------
     7) RELEASE CODE
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
    const content = `
      <p style="font-size:16px; color:#374151;">Hi <b>${name}</b>,</p>
      <p style="font-size:15px; color:#4b5563;">Your delivery for order <b>#${order_id}</b> has arrived at its destination.</p>
      
      <div style="margin: 30px 0; text-align: center;">
        <p style="font-size:14px; color:#6b7280; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Confirmation Code</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 12px; display: inline-block; min-width: 200px; margin-top: 10px; border: 2px dashed #d1d5db;">
          <span style="font-size: 32px; font-family: monospace; font-weight: 700; letter-spacing: 4px; color: #111827;">${release_code}</span>
        </div>
        <p style="font-size:14px; color:#ef4444; margin-top: 15px; font-weight: 500;">
          ⚠ Please share this code ONLY with the courier to confirm you have received the package.
        </p>
      </div>
    `;

    const html = this.tpl.wrapperWithLogo(
      'Delivery Confirmation Code',
      content,
      LOGO_URL,
    );

    return this.email.sendEmail({
      to: email,
      subject: `Your Delivery Code: ${release_code}`,
      html,
    });
  }
}
