import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

@Injectable()
export class EscrowMailService {
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
    const html = this.tpl.wrapper(
      'Escrow Created',
      `
        <p>Hi <b>${name}</b>,</p>
        <p>An escrow has been created for your order <b>#${order_id}</b>.</p>
        <p>Your money is safely held and will only be released after you confirm delivery.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Escrow Created',
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
    const html = this.tpl.wrapper(
      'Escrow Created',
      `
        <p>Hello <b>${name}</b>,</p>
        <p>An escrow has been created for order <b>#${order_id}</b>.</p>
        <p>You will receive ₦${amount} after the customer confirms delivery.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Escrow Started for Your Order',
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
    const html = this.tpl.wrapper(
      'Escrow Funded',
      `
        <p>Hi <b>${name}</b>,</p>
        <p>Your payment for order <b>#${order_id}</b> has been secured in escrow.</p>
        <p>Your money is protected until you confirm delivery.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Escrow Funded',
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
    const html = this.tpl.wrapper(
      'Escrow Funded',
      `
        <p>Hello <b>${name}</b>,</p>
        <p>The payment for order <b>#${order_id}</b> has been funded and held in escrow.</p>
        <p>You will receive the funds once delivery is confirmed.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Escrow Funded',
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
    const html = this.tpl.wrapper(
      'Escrow Released',
      `
        <p>Hello <b>${name}</b>,</p>
        <p>Your payment for order <b>#${order_id}</b> has been released!</p>
        <p>₦${amount} has been transferred to your payout account.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Payment Released',
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
    const html = this.tpl.wrapper(
      'Refund Issued',
      `
        <p>Hi <b>${name}</b>,</p>
        <p>Your order <b>#${order_id}</b> has been cancelled.</p>
        <p>Your payment of ₦${amount} has been refunded.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Refund Processed',
      html,
    });
  }
}
