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

  /**
   * Calculates the transaction fee Paystack would charge so that the
   * merchant receives exactly `amountKobo`.
   * Standard Paystack NG Fee: 1.5% + NGN 100 (if >= 2500), Capped at NGN 2000.
   */
  calculateTransactionFee(amountKobo: number): number {
    const amountNaira = amountKobo / 100;
    let flatFee = 0;
    const percent = 0.015; // 1.5%
    const capKobo = 200000; // 2000 NGN in Kobo

    if (amountNaira >= 2500) {
      flatFee = 100;
    }

    // Formula to GROSS UP so you receive exactly `amountNaira`:
    // total = (amount + flat) / (1 - percent)
    const totalNaira = (amountNaira + flatFee) / (1 - percent);
    let feeKobo = Math.round((totalNaira - amountNaira) * 100);

    // Apply the Paystack NGN 2,000 fee cap
    if (feeKobo > capKobo) {
      feeKobo = capKobo;
    }

    return feeKobo;
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
     GET NIGERIAN BANKS
  ──────────────────────────────────────────────── */
  async getBanksNigeria() {
    try {
      const res = await axios.get(`${this.baseUrl}/bank`, {
        headers: this.headers,
        params: {
          country: 'nigeria',
          currency: 'NGN',
          enabled_for_verification: true,
        },
      });

      return res.data?.data?.map((bank: any) => ({
        name: bank.name,
        code: bank.code,
        slug: bank.slug,
        type: bank.type,
      }));
    } catch (error) {
      this.handleError(error, 'Fetching Nigerian banks');
    }
  }

  /* ────────────────────────────────────────────────
     SUBACCOUNTS (SPLIT PAYMENTS)
  ──────────────────────────────────────────────── */
  async createSubaccount({
    business_name,
    bank_code,
    account_number,
    percentage_charge = 2.5,
  }: {
    business_name: string;
    bank_code: string;
    account_number: string;
    percentage_charge?: number;
  }) {
    try {
      const res = await axios.post(
        `${this.baseUrl}/subaccount`,
        {
          business_name,
          settlement_bank: bank_code,
          account_number,
          percentage_charge,
        },
        { headers: this.headers },
      );

      return res.data?.data?.subaccount_code;
    } catch (error) {
      this.handleError(error, 'Subaccount creation');
    }
  }

  async createSplit(data: {
    name: string;
    type: 'percentage' | 'flat';
    currency: string;
    subaccounts: { subaccount: string; share: number }[];
    bearer_type: 'subaccount' | 'account' | 'all-pro-rata' | 'all';
    bearer_subaccount?: string;
  }) {
    try {
      const res = await axios.post(`${this.baseUrl}/split`, data, {
        headers: this.headers,
      });
      return res.data?.data;
    } catch (error) {
      this.handleError(error, 'Split creation');
    }
  }

  /* ────────────────────────────────────────────────
     PAYMENTS: INITIALIZATION
  ──────────────────────────────────────────────── */
  async initializePayment(
    email: string,
    amountKobo: number, // Net amount expected (Price + Shipping + Platform Fee)
    options?: {
      subaccount?: string;
      split_code?: string;
      reference?: string;
      transaction_charge?: number;
      bearer?: 'account' | 'subaccount';
      callback_url?: string;
      metadata?: any;
    },
  ) {
    try {
      // 🔥 Calculate Gross: Charge customer exactly (Net Amount + Paystack Fee)
      const paystackFee = this.calculateTransactionFee(amountKobo);
      const amountToCharge = Math.round(amountKobo + paystackFee);

      const payload: any = {
        email,
        amount: amountToCharge,
        currency: 'NGN',
        callback_url:
          options?.callback_url ||
          `${process.env.FRONTEND_URL}/account/verify-payment`,
        metadata: options?.metadata,
      };

      if (options?.reference) {
        payload.reference = options.reference;
      }

      if (options?.subaccount && !options?.split_code) {
        payload.subaccount = options.subaccount;
        payload.bearer = options.bearer || 'subaccount';
      }

      if (options?.split_code) {
        payload.split_code = options.split_code;
      }

      if (options?.transaction_charge) {
        payload.transaction_charge = options.transaction_charge;
      }

      const res = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        payload,
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
      const res = await axios.get(`${this.baseUrl}/bank/resolve`, {
        headers: this.headers,
        params: { account_number, bank_code },
      });

      const data = res.data?.data;
      if (!data?.account_name)
        throw new BadRequestException('Invalid bank details');

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
     TRANSFERS & RECIPIENTS
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
        throw new BadRequestException('Recipient creation failed');
      }

      return res.data.data.recipient_code;
    } catch (error) {
      this.handleError(error, 'Recipient creation');
    }
  }

  async initiateTransfer({
    recipient_code,
    amountKobo,
    reason,
  }: {
    recipient_code: string;
    amountKobo: number;
    reason: string;
  }) {
    if (!recipient_code)
      throw new BadRequestException('Recipient code required');
    const reference = `pay_${uuidv4().replace(/-/g, '')}`;

    try {
      const res = await axios.post(
        `${this.baseUrl}/transfer`,
        {
          source: 'balance',
          recipient: recipient_code,
          amount: Math.round(amountKobo),
          reason,
          reference,
        },
        { headers: this.headers },
      );

      return { ok: true, reference, ...res.data.data };
    } catch (error: any) {
      return {
        ok: false,
        reference,
        error: error.response?.data || error.message,
      };
    }
  }
}
