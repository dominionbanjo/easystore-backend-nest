import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as QRCode from 'qrcode';
import { Order } from '../entities/order.entity';

@Injectable()
export class ReceiptService {
  async generateReceiptPdf(order: Order): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Branding / Header
    page.drawText('EazyStore Receipt', {
      x: 50,
      y: height - 50,
      size: 24,
      font: boldFont,
      color: rgb(0.388, 0.4, 0.945), // Indigo-500
    });

    page.drawText('Thank you for your purchase!', {
      x: 50,
      y: height - 80,
      size: 12,
      font: regularFont,
      color: rgb(0.42, 0.447, 0.5), // Gray-500
    });

    // Order Info
    const orderId = order.id.split('-')[0].toUpperCase();
    page.drawText(`Order ID: #${orderId}`, {
      x: 50,
      y: height - 120,
      size: 14,
      font: boldFont,
    });

    page.drawText(`Date: ${new Date(order.created_at).toLocaleDateString()}`, {
      x: 50,
      y: height - 140,
      size: 10,
      font: regularFont,
    });

    page.drawText(`Status: PAID`, {
      x: 50,
      y: height - 160,
      size: 10,
      font: boldFont,
      color: rgb(0.063, 0.616, 0.345), // Emerald-600
    });

    // Table Header
    const tableTop = height - 200;
    page.drawLine({
      start: { x: 50, y: tableTop },
      end: { x: 550, y: tableTop },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    });

    page.drawText('Product', {
      x: 50,
      y: tableTop - 20,
      size: 10,
      font: boldFont,
    });
    page.drawText('Qty', {
      x: 400,
      y: tableTop - 20,
      size: 10,
      font: boldFont,
    });
    page.drawText('Price', {
      x: 500,
      y: tableTop - 20,
      size: 10,
      font: boldFont,
    });

    page.drawLine({
      start: { x: 50, y: tableTop - 30 },
      end: { x: 550, y: tableTop - 30 },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Table Rows
    let currentY = tableTop - 50;
    for (const item of order.order_items) {
      if (currentY < 100) break; // Basic pagination prevention for now

      page.drawText(item.name.substring(0, 45), {
        x: 50,
        y: currentY,
        size: 10,
        font: regularFont,
      });
      page.drawText(`x${item.quantity}`, {
        x: 400,
        y: currentY,
        size: 10,
        font: regularFont,
      });
      page.drawText(`NGN ${(item.unit_price / 100).toLocaleString()}`, {
        x: 500,
        y: currentY,
        size: 10,
        font: regularFont,
      });

      currentY -= 20;
    }

    // Summary
    const summaryY = currentY - 40;
    page.drawLine({
      start: { x: 350, y: summaryY + 20 },
      end: { x: 550, y: summaryY + 20 },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    });

    page.drawText('Subtotal:', {
      x: 350,
      y: summaryY,
      size: 10,
      font: regularFont,
    });
    page.drawText(`NGN ${(Number(order.subtotal) / 100).toLocaleString()}`, {
      x: 500,
      y: summaryY,
      size: 10,
      font: regularFont,
    });

    page.drawText('Shipping:', {
      x: 350,
      y: summaryY - 20,
      size: 10,
      font: regularFont,
    });
    page.drawText(
      `NGN ${(Number(order.shipping_fee) / 100).toLocaleString()}`,
      { x: 500, y: summaryY - 20, size: 10, font: regularFont },
    );

    page.drawText('Total:', {
      x: 350,
      y: summaryY - 50,
      size: 14,
      font: boldFont,
    });
    page.drawText(`NGN ${(Number(order.total) / 100).toLocaleString()}`, {
      x: 500,
      y: summaryY - 50,
      size: 14,
      font: boldFont,
      color: rgb(0.388, 0.4, 0.945),
    });

    // QR Code for Verification
    const verificationUrl = `https://eazystore.com.ng/verify-receipt/${order.id}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);
    const qrImage = await pdfDoc.embedPng(qrCodeDataUrl);

    page.drawImage(qrImage, {
      x: 50,
      y: 50,
      width: 80,
      height: 80,
    });

    page.drawText('Scan to verify receipt', {
      x: 50,
      y: 40,
      size: 8,
      font: regularFont,
      color: rgb(0.6, 0.6, 0.6),
    });

    // Footer
    page.drawText('EazyStore Inc. | Support: support@easystore.com', {
      x: width / 2 - 100,
      y: 20,
      size: 8,
      font: regularFont,
      color: rgb(0.6, 0.6, 0.6),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
