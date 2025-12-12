import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

@Injectable()
export class DeliveryMailService {
  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {}

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
    const html = this.tpl.wrapper(
      'Delivery Started',
      `
        <p>Hi <b>${name}</b>,</p>
        <p>Your order <b>#${order_id}</b> is now being processed for delivery.</p>
        <p>We will keep you updated along the way.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Your Delivery Has Started',
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
    const html = this.tpl.wrapper(
      'Delivery Created',
      `
        <p>Hello <b>${name}</b>,</p>
        <p>A delivery has been created for order <b>#${order_id}</b>.</p>
        <p>Please prepare the package for pickup.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Delivery Created for Your Order',
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
    const html = this.tpl.wrapper(
      'Courier Assigned',
      `
        <p>Hi <b>${name}</b>,</p>
        <p>A courier has been assigned to your delivery for order <b>#${order_id}</b>.</p>
        <p>Courier ID: <b>${courier_id}</b></p>
      `,
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
    const html = this.tpl.wrapper(
      'Courier Assigned',
      `
        <p>Hello <b>${name}</b>,</p>
        <p>A courier has been assigned to deliver order <b>#${order_id}</b>.</p>
        <p>Courier ID: <b>${courier_id}</b></p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Courier Assigned',
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
    const html = this.tpl.wrapper(
      'Delivery Update',
      `
        <p>Hi <b>${name}</b>,</p>
        <p>Your delivery for order <b>#${order_id}</b> has been updated to:</p>
        <h2 style="text-align:center;">${status}</h2>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Delivery Status Updated',
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
    const html = this.tpl.wrapper(
      'Delivery Update',
      `
        <p>Hello <b>${name}</b>,</p>
        <p>The delivery status for order <b>#${order_id}</b> has been updated to:</p>
        <h2 style="text-align:center;">${status}</h2>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Delivery Status Updated',
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
    const html = this.tpl.wrapper(
      'Delivery Delivered',
      `
        <p>Hi <b>${name}</b>,</p>
        <p>Your package for order <b>#${order_id}</b> has been marked as <b>delivered</b>.</p>
        <p>Please confirm delivery in the EasyStore app.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Package Delivered',
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
    const html = this.tpl.wrapper(
      'Delivery Delivered',
      `
        <p>Hello <b>${name}</b>,</p>
        <p>The package for order <b>#${order_id}</b> has been marked delivered.</p>
        <p>Waiting for customer confirmation.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Order Delivered',
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
    const html = this.tpl.wrapper(
      'Delivery Confirmed',
      `
        <p>Hi <b>${name}</b>,</p>
        <p>Delivery for order <b>#${order_id}</b> has been confirmed.</p>
        <p>Thank you for shopping with EasyStore.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Delivery Confirmed',
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
    const html = this.tpl.wrapper(
      'Escrow Released',
      `
        <p>Hello <b>${name}</b>,</p>
        <p>Delivery for order <b>#${order_id}</b> has been confirmed by the customer.</p>
        <p>Escrow payment has now been released to you.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Delivery Confirmed — Escrow Released',
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
    const html = this.tpl.wrapper(
      'Proof of Delivery Uploaded',
      `
        <p>Hi <b>${name}</b>,</p>
        <p>A proof of delivery has been uploaded for order <b>#${order_id}</b>.</p>
        <p>You can review it in the EasyStore app.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Proof of Delivery Uploaded',
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
    const html = this.tpl.wrapper(
      'Delivery Code',
      `
        <p>Hi <b>${name}</b>,</p>
        <p>Your delivery for order <b>#${order_id}</b> has arrived.</p>
        <p>Your confirmation code is:</p>
        <h2 style="text-align:center;">${release_code}</h2>
        <p>Give this code ONLY to the courier/vendor when receiving your item.</p>
      `,
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Your Delivery Confirmation Code',
      html,
    });
  }
}
