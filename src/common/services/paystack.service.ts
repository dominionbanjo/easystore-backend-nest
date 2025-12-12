import { Injectable, BadRequestException } from '@nestjs/common';
import Paystack from '@paystack/paystack-sdk'; // ✔️ default import
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaystackService {
  private paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY!); // ✔️ MUST use new

  private handleError(error: any, context: string): never {
    console.error('🔥 PAYSTACK SDK ERROR:', {
      context,
      message: error?.message,
      response: error?.response,
    });

    throw new BadRequestException(`${context} failed: ${error?.message}`);
  }

  async initializePayment(email: string, amount: number) {
    try {
      const res = await this.paystack.transaction.initialize({
        email,
        amount: Math.round(amount * 100),
        currency: 'NGN',
        callback_url: `${process.env.BASE_URL}/verify`,
      });

      return res.data;
    } catch (error) {
      this.handleError(error, 'Payment initialization');
    }
  }

  async verifyPayment(reference: string) {
    try {
      const res = await this.paystack.transaction.verify({ reference });
      return res.data;
    } catch (error) {
      this.handleError(error, 'Payment verification');
    }
  }

  async verifyBankAccount(account_number: string, bank_code: string) {
    try {
      const res = await this.paystack.verification.resolveAccount({
        account_number,
        bank_code,
      });

      const data = res.data;

      if (!data?.account_name) {
        throw new BadRequestException('Invalid bank details');
      }

      const banks = await this.paystack.misc.listBanks({ currency: 'NGN' });
      const bank = banks.data.find((b: any) => b.code === bank_code);

      return {
        account_name: data.account_name,
        account_number: data.account_number,
        bank_name: bank?.name ?? 'Unknown Bank',
        bank_id: data.bank_id,
      };
    } catch (error) {
      this.handleError(error, 'Bank verification');
    }
  }

  async createTransferRecipient({
    name,
    account_number,
    bank_code,
  }: {
    name: string;
    account_number: string;
    bank_code: string;
  }) {
    try {
      const res = await this.paystack.transferRecipient.create({
        type: 'nuban',
        name,
        bank_code,
        account_number,
        currency: 'NGN',
      });

      if (!res.data?.recipient_code) {
        throw new BadRequestException('Unable to create Paystack recipient');
      }

      return res.data.recipient_code;
    } catch (error) {
      this.handleError(error, 'Transfer recipient creation');
    }
  }

  async initiateTransfer({
    recipient_code,
    amount,
    reason,
  }: {
    recipient_code: string;
    amount: number;
    reason: string;
  }) {
    if (!recipient_code) {
      throw new BadRequestException('Recipient code is required');
    }

    const reference = `pay_${uuidv4().replace(/-/g, '').toLowerCase()}`;

    try {
      const res = await this.paystack.transfer.initiate({
        source: 'balance',
        reason,
        amount: Math.round(amount * 100),
        recipient: recipient_code,
        reference,
      });

      return {
        ok: true,
        reference,
        ...res.data,
      };
    } catch (error) {
      return {
        ok: false,
        reference,
        error: error.response || error.message || 'Unknown transfer error',
      };
    }
  }
}
