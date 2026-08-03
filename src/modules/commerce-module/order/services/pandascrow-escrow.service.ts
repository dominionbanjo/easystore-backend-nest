import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/* ────────────────────────────────────────────────
   RESPONSE TYPES
──────────────────────────────────────────────── */
interface PandascrowInitializeResponse {
  status: boolean;
  data: {
    escrow_id: number;
    status: string;
    type: string;
    payment_url: string;
    transaction_ref: string;
    provider: string;
  };
}

interface PandascrowCompleteResponse {
  success: boolean;
}

interface PandascrowError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

@Injectable()
export class PandascrowEscrowService {
  private readonly baseUrl = process.env.PANDASCROW_BASE_URL!;
  private readonly token = process.env.PANDASCROW_API_KEY!;
  private readonly publicKey = process.env.PANDASCROW_PUBLIC_KEY!;
  private readonly userId = process.env.PANDASCROW_USER_ID!;

  constructor(private readonly http: HttpService) {}

  /* ────────────────────────────────────────────────
     INITIALIZE ONE-TIME ESCROW (PANDASCROW)
     POST /escrow/initialize
  ──────────────────────────────────────────────── */
  async initializeEscrow(params: {
    title: string;
    description: string;
    acceptance_criteria?: string;

    amount: number;
    currency: string;

    inspection_period: string; // e.g. "1" (days)
    delivery_date: string; // YYYY-MM-DD
    who_pay_fees: 'buyer' | 'seller' | 'both';

    dispute_window?: string; // e.g. "2" (days)
    how_dispute_is_handled?: 'platform' | 'arbitration';

    buyer_details: {
      name: string;
      email: string;
      phone: string;
    };
  }): Promise<PandascrowInitializeResponse> {
    try {
      const payload = {
        uuid: this.userId,
        escrow_type: 'onetime',
        initiator_role: 'seller',
        initiator_id: this.userId,
        receiver_id: '',

        title: params.title,
        currency: params.currency,
        description: params.description,
        acceptance_criteria: params.acceptance_criteria || '',
        inspection_period: params.inspection_period,
        delivery_date: params.delivery_date,
        how_dispute_is_handled: params.how_dispute_is_handled || 'platform',
        who_pay_fees: params.who_pay_fees,
        amount: params.amount,
        dispute_window: params.dispute_window || '2',

        buyer_details: params.buyer_details,
      };

      const response = await firstValueFrom(
        this.http.post<PandascrowInitializeResponse>(
          `${this.baseUrl}/escrow/initialize`,
          payload,
          {
            headers: {
              Token: this.token,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (err: unknown) {
      const pandascrowError = err as PandascrowError;
      console.error(
        'Pandascrow initialization error:',
        pandascrowError?.response?.data,
      );
      throw new InternalServerErrorException(
        pandascrowError?.response?.data?.message ??
          'Pandascrow escrow initialization failed',
      );
    }
  }

  /* ────────────────────────────────────────────────
     MARK ESCROW AS COMPLETE (OTP CONFIRMATION)
     POST /escrow/complete
  ──────────────────────────────────────────────── */
  async completeEscrow(params: { escrow_id: number; otp: string }) {
    try {
      const payload = {
        uuid: this.userId,
        escrow_id: params.escrow_id,
        otp: params.otp,
      };

      const response = await firstValueFrom(
        this.http.post<PandascrowCompleteResponse>(
          `${this.baseUrl}/escrow/complete`,
          payload,
          {
            headers: {
              Token: this.token,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (err: unknown) {
      const pandascrowError = err as PandascrowError;
      console.error(
        'Pandascrow completion error:',
        pandascrowError?.response?.data,
      );
      throw new BadRequestException(
        pandascrowError?.response?.data?.message ??
          'Pandascrow escrow completion failed',
      );
    }
  }
}
