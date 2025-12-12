import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

interface OrderMailPayload {
  email: string;
  name: string;
  order: { id: string; status: string; total: number };
}

@Injectable()
export class OrderMailService {
  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {}

  async sendOrderCreated(payload: OrderMailPayload) {
    const html = this.tpl.wrapper(
      'Order Created',
      `
        <p>Hi <b>${payload.name}</b>,</p>
        <p>Your order <b>#${payload.order.id}</b> has been created successfully.</p>
        <p>Status: <b>${payload.order.status}</b></p>
        <p>Total: ₦${payload.order.total}</p>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: 'Your Order Has Been Created',
      html,
    });
  }

  async sendVendorNewOrder(payload: OrderMailPayload) {
    const html = this.tpl.wrapper(
      'New Order Received',
      `
        <p>Hello <b>${payload.name}</b>,</p>
        <p>You received a new order <b>#${payload.order.id}</b>.</p>
        <p>Total: ₦${payload.order.total}</p>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: 'New Order Alert',
      html,
    });
  }

  async sendPaymentInitialized(payload: OrderMailPayload) {
    const html = this.tpl.wrapper(
      'Payment Started',
      `
        <p>Hi <b>${payload.name}</b>,</p>
        <p>Your payment process for order <b>#${payload.order.id}</b> has been initialized.</p>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: 'Payment Started',
      html,
    });
  }

  async sendPaymentVerified(payload: OrderMailPayload) {
    const html = this.tpl.wrapper(
      'Payment Verified',
      `
        <p>Hi <b>${payload.name}</b>,</p>
        <p>Your payment for order <b>#${payload.order.id}</b> was confirmed.</p>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: 'Payment Verified',
      html,
    });
  }

  async sendVendorPaymentVerified(payload: OrderMailPayload) {
    const html = this.tpl.wrapper(
      'Payment Confirmed',
      `
        <p>Hello <b>${payload.name}</b>,</p>
        <p>Payment for order <b>#${payload.order.id}</b> has been confirmed.</p>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: 'Order Payment Confirmed',
      html,
    });
  }

  async sendOrderStatusUpdate(payload: OrderMailPayload & { status: string }) {
    const html = this.tpl.wrapper(
      'Order Update',
      `
        <p>Hi <b>${payload.name}</b>,</p>
        <p>Your order <b>#${payload.order.id}</b> status changed to:</p>
        <h2>${payload.status}</h2>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: 'Order Status Updated',
      html,
    });
  }

  async sendOrderCanceled(payload: OrderMailPayload) {
    const html = this.tpl.wrapper(
      'Order Cancelled',
      `
        <p>Hi <b>${payload.name}</b>,</p>
        <p>Your order <b>#${payload.order.id}</b> has been cancelled.</p>
      `,
    );

    return this.email.sendEmail({
      to: payload.email,
      subject: 'Order Cancelled',
      html,
    });
  }
}
