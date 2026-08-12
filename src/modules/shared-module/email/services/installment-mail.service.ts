import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

interface PlanMailBase {
  email: string;
  name: string;
  planId: string;
  orderId: string;
  totalNaira: number;
  paidNaira: number;
}

interface ScheduleRow {
  index: number;
  amountNaira: number;
  dueDate: string;
  status: string;
}

@Injectable()
export class InstallmentMailService {
  constructor(
    private readonly email: EmailService,
    private readonly tpl: EmailTemplateService,
  ) {}

  private renderSchedule(rows: ScheduleRow[]): string {
    if (!rows.length) return '';
    const body = rows
      .map(
        (row) => `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; font-size: 14px; color: #374151;">Installment ${row.index}</td>
          <td style="padding: 10px 0; font-size: 14px; color: #374151;">₦${row.amountNaira.toLocaleString()}</td>
          <td style="padding: 10px 0; font-size: 14px; color: #6b7280;">${row.dueDate}</td>
          <td style="padding: 10px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: ${row.status === 'Paid' ? '#059669' : '#d97706'};">${row.status}</td>
        </tr>`,
      )
      .join('');
    return `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 10px 0; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Installment</th>
            <th style="padding: 10px 0; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Amount</th>
            <th style="padding: 10px 0; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Due</th>
            <th style="padding: 10px 0; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Status</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    `;
  }

  private wrap(
    title: string,
    content: string,
    ctaText: string,
    ctaUrl: string,
  ): string {
    return `
      <div style="max-width: 560px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <div style="padding: 32px; background: #ffffff; border-radius: ${this.tpl.borderRadius}; border: 1px solid #e5e7eb;">
          <h1 style="margin: 0 0 16px; font-size: 20px; color: #111827;">${title}</h1>
          ${content}
          <div style="text-align: center; margin: 28px 0 8px;">
            <a href="${ctaUrl}" style="background: ${this.tpl.brandColor}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: ${this.tpl.borderRadius}; font-weight: 700; display: inline-block;">${ctaText}</a>
          </div>
        </div>
      </div>
    `;
  }

  async sendPlanStarted(
    data: PlanMailBase & { rows: ScheduleRow[]; nextDue: string },
  ) {
    const content = `
      <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">Your installment plan for order <strong>#${data.orderId.slice(0, 8)}</strong> has started. Pay each installment on or before its due date to keep the product reserved for you — the vendor ships once the plan is fully paid.</p>
      ${this.renderSchedule(data.rows)}
      <p style="font-size: 14px; color: #4b5563;">Total: ₦${data.totalNaira.toLocaleString()} · Paid so far: ₦${data.paidNaira.toLocaleString()}</p>
    `;
    await this.email.sendEmail({
      to: data.email,
      subject: 'Your installment plan has started',
      html: this.wrap(
        'Installment Plan Started',
        content,
        'View My Plan',
        `${process.env.FRONTEND_URL}/account/orders/${data.orderId}`,
      ),
    });
  }

  async sendInstallmentDue(
    data: PlanMailBase & { amountDueNaira: number; dueDate: string },
  ) {
    const content = `
      <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">Installment <strong>₦${data.amountDueNaira.toLocaleString()}</strong> for order <strong>#${data.orderId.slice(0, 8)}</strong> is due on <strong>${data.dueDate}</strong>. Please pay to keep your product reserved.</p>
      <p style="font-size: 14px; color: #4b5563;">Paid so far: ₦${data.paidNaira.toLocaleString()} of ₦${data.totalNaira.toLocaleString()}</p>
    `;
    await this.email.sendEmail({
      to: data.email,
      subject: 'Installment payment due',
      html: this.wrap(
        'Payment Due',
        content,
        'Pay Installment',
        `${process.env.FRONTEND_URL}/account/orders/${data.orderId}`,
      ),
    });
  }

  async sendReminder(
    data: PlanMailBase & {
      amountDueNaira: number;
      daysLeft: number;
      final: boolean;
    },
  ) {
    const title = data.final
      ? 'Final Warning — Pay Within 48 Hours'
      : 'You Are Behind on Your Installment';
    const content = `
      <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">You have <strong>${data.daysLeft} day(s)</strong> to pay installment <strong>₦${data.amountDueNaira.toLocaleString()}</strong> for order <strong>#${data.orderId.slice(0, 8)}</strong>.</p>
      <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">${data.final ? 'If payment is not received within 48 hours, your plan will be canceled and all money paid will be refunded to your original payment method.' : 'If the payment is not received, your plan will be canceled and all money paid will be refunded.'}</p>
    `;
    await this.email.sendEmail({
      to: data.email,
      subject: title,
      html: this.wrap(
        title,
        content,
        'Pay Now',
        `${process.env.FRONTEND_URL}/account/orders/${data.orderId}`,
      ),
    });
  }

  async sendDefaultedRefunded(data: PlanMailBase) {
    const content = `
      <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">Your installment plan for order <strong>#${data.orderId.slice(0, 8)}</strong> has been canceled because an installment was not paid on time. The product is no longer reserved for you.</p>
      <p style="font-size: 14px; color: #4b5563;">All <strong>₦${data.paidNaira.toLocaleString()}</strong> you paid has been refunded to your original payment method (refunds typically take 1–2 business days to appear).</p>
    `;
    await this.email.sendEmail({
      to: data.email,
      subject: 'Your installment plan was canceled & refunded',
      html: this.wrap(
        'Plan Canceled — Refund Initiated',
        content,
        'View Order',
        `${process.env.FRONTEND_URL}/account/orders/${data.orderId}`,
      ),
    });
  }

  async sendPlanCompleted(data: PlanMailBase & { isVendor: boolean }) {
    const content = data.isVendor
      ? `<p style="font-size: 14px; color: #4b5563; line-height: 1.6;">The buyer has fully paid the installment plan for order <strong>#${data.orderId.slice(0, 8)}</strong> (₦${data.totalNaira.toLocaleString()}). Please prepare the order for delivery — payment is complete and the funds are held in escrow until delivery is confirmed.</p>`
      : `<p style="font-size: 14px; color: #4b5563; line-height: 1.6;">Congratulations! Your installment plan for order <strong>#${data.orderId.slice(0, 8)}</strong> is fully paid (₦${data.totalNaira.toLocaleString()}). The vendor has been notified and your order will be shipped.</p>`;
    await this.email.sendEmail({
      to: data.email,
      subject: data.isVendor
        ? 'Installment plan fully paid — prepare delivery'
        : 'Your installment plan is fully paid',
      html: this.wrap(
        'Plan Completed',
        content,
        data.isVendor ? 'View Order' : 'Track Order',
        `${process.env.FRONTEND_URL}/account/orders/${data.orderId}`,
      ),
    });
  }

  async sendAutoChargeFailed(data: PlanMailBase & { amountDueNaira: number }) {
    const content = `
      <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">We could not automatically charge your saved card for installment <strong>₦${data.amountDueNaira.toLocaleString()}</strong> on order <strong>#${data.orderId.slice(0, 8)}</strong>.</p>
      <p style="font-size: 14px; color: #4b5563;">Please pay manually before the due date, or update your card. Repeated failures will cancel the plan and refund your payments.</p>
    `;
    await this.email.sendEmail({
      to: data.email,
      subject: 'Auto-payment failed — please pay manually',
      html: this.wrap(
        'Auto-Payment Failed',
        content,
        'Pay Manually',
        `${process.env.FRONTEND_URL}/account/orders/${data.orderId}`,
      ),
    });
  }
}
