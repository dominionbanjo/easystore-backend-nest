import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';

  private readonly headers = {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };

  constructor() {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY is not set');
    }
  }

  /* ────────────────────────────────────────────────
     INTERNAL ERROR HANDLER
  ──────────────────────────────────────────────── */
  private handleError(error: any, context: string): never {
    console.error('🔥 PAYSTACK ERROR:', {
      context,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      error.message ||
      'Paystack request failed';

    if (status === 401) {
      throw new BadRequestException(
        'Paystack authentication failed (invalid API key)',
      );
    }

    if (status === 422) {
      throw new BadRequestException(
        `${context} failed — invalid or unprocessable data`,
      );
    }

    if (status === 400) {
      throw new BadRequestException(`${context} failed — bad request`);
    }

    throw new BadRequestException(`${context} failed: ${message}`);
  }

  /* ────────────────────────────────────────────────
     PAYMENTS
  ──────────────────────────────────────────────── */

  async initializePayment(email: string, amount: number) {
    try {
      const res = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount: Math.round(amount * 100),
          currency: 'NGN',
          callback_url: `${process.env.BASE_URL}/verify`,
        },
        { headers: this.headers },
      );

      return res.data.data;
    } catch (error) {
      this.handleError(error, 'Payment initialization');
    }
  }

  async verifyPayment(reference: string) {
    try {
      const res = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        { headers: this.headers },
      );

      return res.data.data;
    } catch (error) {
      this.handleError(error, 'Payment verification');
    }
  }

  /* ────────────────────────────────────────────────
     BANK VERIFICATION
  ──────────────────────────────────────────────── */

  async verifyBankAccount(account_number: string, bank_code: string) {
    try {
      // Resolve account
      const res = await axios.get(`${this.baseUrl}/bank/resolve`, {
        headers: this.headers,
        params: { account_number, bank_code },
      });

      const data = res.data?.data;

      if (!data?.account_name) {
        throw new BadRequestException('Invalid bank details');
      }

      // Fetch bank name
      const banksRes = await axios.get(`${this.baseUrl}/bank`, {
        headers: this.headers,
      });

      const bank = banksRes.data?.data?.find((b: any) => b.code === bank_code);

      return {
        account_name: data.account_name,
        account_number: data.account_number,
        bank_id: data.bank_id,
        bank_name: bank?.name ?? 'Unknown Bank',
      };
    } catch (error) {
      this.handleError(error, 'Bank verification');
    }
  }

  /* ────────────────────────────────────────────────
     TRANSFER RECIPIENT
  ──────────────────────────────────────────────── */

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
      const res = await axios.post(
        `${this.baseUrl}/transferrecipient`,
        {
          type: 'nuban',
          name,
          account_number,
          bank_code,
          currency: 'NGN',
        },
        { headers: this.headers },
      );

      if (!res.data?.data?.recipient_code) {
        throw new BadRequestException(
          'Unable to create Paystack transfer recipient',
        );
      }

      return res.data.data.recipient_code;
    } catch (error) {
      this.handleError(error, 'Transfer recipient creation');
    }
  }

  /* ────────────────────────────────────────────────
     TRANSFERS
  ──────────────────────────────────────────────── */

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

    const reference = `pay_${uuidv4().replace(/-/g, '')}`;

    try {
      const res = await axios.post(
        `${this.baseUrl}/transfer`,
        {
          source: 'balance',
          recipient: recipient_code,
          amount: Math.round(amount * 100),
          reason,
          reference,
        },
        { headers: this.headers },
      );

      return {
        ok: true,
        reference,
        ...res.data.data,
      };
    } catch (error: any) {
      return {
        ok: false,
        reference,
        error:
          error.response?.data || error.message || 'Unknown transfer error',
      };
    }
  }
}
