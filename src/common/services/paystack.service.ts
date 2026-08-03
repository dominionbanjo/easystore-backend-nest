import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

interface PaystackApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface PaystackBank {
  name: string;
  code: string;
  slug: string;
  type: string;
}

interface PaystackSubaccountData {
  subaccount_code: string;
}

interface PaystackSplitData {
  split_code: string;
}

export interface PaystackInitializeData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifyData {
  status: string;
  amount: number;
  reference: string;
}

interface PaystackBankResolveData {
  account_name: string;
  account_number: string;
  bank_id: number;
}

export interface VerifiedBankAccount {
  account_name: string;
  account_number: string;
  bank_id: number;
  bank_name: string;
}

interface PaystackRecipientData {
  recipient_code: string;
}

interface PaystackTransferData {
  reference: string;
  transfer_code: string;
}

interface PaystackError {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
}

interface InitializePaymentOptions {
  subaccount?: string;
  split_code?: string;
  reference?: string;
  transaction_charge?: number;
  bearer?: 'account' | 'subaccount';
  callback_url?: string;
  metadata?: Record<string, unknown>;
}

interface InitializePaymentPayload {
  email: string;
  amount: number;
  currency: string;
  callback_url: string;
  metadata?: Record<string, unknown>;
  reference?: string;
  subaccount?: string;
  bearer?: 'account' | 'subaccount';
  split_code?: string;
  transaction_charge?: number;
}

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
   * Calculates the transaction fee Paystack would charge for a given amount.
   * Formula handles the 1.5% + NGN 100 fee structure and NGN 2,000 cap.
   * @param amountKobo The amount in kobo the merchant wants to receive
   */
  calculateTransactionFee(amountKobo: number): number {
    const amountNaira = amountKobo / 100;
    const percent = 0.015; // 1.5%
    const cap = 2000; // 2000 NGN

    const thresholdNaira = 2462.5;
    let flatFee = 0;

    if (amountNaira >= thresholdNaira) {
      flatFee = 100;
    }

    // Formula to ensure merchant receives exactly `amountNaira`:
    // total = (amount + flat) / (1 - percent)
    const totalNaira = (amountNaira + flatFee) / (1 - percent);

    // Initial fee calculation
    let feeNaira = totalNaira - amountNaira;

    // Apply cap
    if (feeNaira > cap) {
      feeNaira = cap;
    }

    // Round up to nearest kobo
    return Math.ceil(feeNaira * 100);
  }

  /* ────────────────────────────────────────────────
     INTERNAL ERROR HANDLER
  ──────────────────────────────────────────────── */
  private handleError(error: unknown, context: string): never {
    const err = error as PaystackError;

    console.error('🔥 PAYSTACK ERROR:', {
      context,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });

    const status = err.response?.status;
    const message =
      err.response?.data?.message || err.message || 'Paystack request failed';

    if (status === 401) {
      throw new BadRequestException(
        'Paystack authentication failed (invalid API key)',
      );
    }

    if (status === 422) {
      throw new BadRequestException(
        message || `${context} failed — invalid or unprocessable data`,
      );
    }

    if (status === 400) {
      throw new BadRequestException(
        message || `${context} failed — bad request`,
      );
    }

    throw new BadRequestException(`${context} failed: ${message}`);
  }
  /* ────────────────────────────────────────────────
   GET NIGERIAN BANKS
──────────────────────────────────────────────── */
  async getBanksNigeria(): Promise<PaystackBank[] | undefined> {
    try {
      const res = await axios.get<PaystackApiResponse<PaystackBank[]>>(
        `${this.baseUrl}/bank`,
        {
          headers: this.headers,
          params: {
            country: 'nigeria',
            currency: 'NGN',
            enabled_for_verification: true,
          },
        },
      );

      return res.data?.data?.map((bank) => ({
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
    PAYMENTS
  ──────────────────────────────────────────────── */

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
  }): Promise<string | undefined> {
    try {
      const res = await axios.post<PaystackApiResponse<PaystackSubaccountData>>(
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
  }): Promise<PaystackSplitData | undefined> {
    try {
      const res = await axios.post<PaystackApiResponse<PaystackSplitData>>(
        `${this.baseUrl}/split`,
        data,
        {
          headers: this.headers,
        },
      );
      return res.data?.data;
    } catch (error) {
      this.handleError(error, 'Split creation');
    }
  }

  /* ────────────────────────────────────────────────
     PAYMENTS
  ──────────────────────────────────────────────── */

  async initializePayment(
    email: string,
    amountKobo: number,
    options?: InitializePaymentOptions,
  ): Promise<PaystackInitializeData | undefined> {
    try {
      const payload: InitializePaymentPayload = {
        email,
        amount: Math.round(amountKobo), // ALREADY IN KOBO
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

      const res = await axios.post<PaystackApiResponse<PaystackInitializeData>>(
        `${this.baseUrl}/transaction/initialize`,
        payload,
        {
          headers: this.headers,
        },
      );

      return res.data.data;
    } catch (error) {
      this.handleError(error, 'Payment initialization');
    }
  }

  async verifyPayment(
    reference: string,
  ): Promise<PaystackVerifyData | undefined> {
    try {
      const res = await axios.get<PaystackApiResponse<PaystackVerifyData>>(
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

  async verifyBankAccount(
    account_number: string,
    bank_code: string,
  ): Promise<VerifiedBankAccount | undefined> {
    try {
      // Resolve account
      const res = await axios.get<PaystackApiResponse<PaystackBankResolveData>>(
        `${this.baseUrl}/bank/resolve`,
        {
          headers: this.headers,
          params: { account_number, bank_code },
        },
      );

      const data = res.data?.data;

      if (!data?.account_name) {
        throw new BadRequestException('Invalid bank details');
      }

      // Fetch bank name
      const banksRes = await axios.get<PaystackApiResponse<PaystackBank[]>>(
        `${this.baseUrl}/bank`,
        {
          headers: this.headers,
        },
      );

      const bank = banksRes.data?.data?.find((b) => b.code === bank_code);

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
  }): Promise<string | undefined> {
    try {
      const res = await axios.post<PaystackApiResponse<PaystackRecipientData>>(
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
    amountKobo,
    reason,
  }: {
    recipient_code: string;
    amountKobo: number;
    reason: string;
  }) {
    if (!recipient_code) {
      throw new BadRequestException('Recipient code is required');
    }

    const reference = `pay_${uuidv4().replace(/-/g, '')}`;

    try {
      const res = await axios.post<PaystackApiResponse<PaystackTransferData>>(
        `${this.baseUrl}/transfer`,
        {
          source: 'balance',
          recipient: recipient_code,
          amount: Math.round(amountKobo), // ALREADY IN KOBO
          reason,
          reference,
        },
        { headers: this.headers },
      );

      return {
        ok: true,
        ...res.data.data,
        reference,
      };
    } catch (error: unknown) {
      const err = error as PaystackError;
      return {
        ok: false,
        reference,
        error: err.response?.data || err.message || 'Unknown transfer error',
      };
    }
  }
}
