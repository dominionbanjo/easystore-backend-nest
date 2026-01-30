import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PandascrowEscrowService {
  private readonly baseUrl = process.env.PANDASCROW_BASE_URL!;
  private readonly token = process.env.PANDASCROW_API_KEY!; // internal key

  constructor(private readonly http: HttpService) {}

  /* ────────────────────────────────────────────────
     INITIALIZE ONE-TIME ESCROW (PANDASCROW)
     POST /escrow/initialize
  ──────────────────────────────────────────────── */
  async initializeEscrow(params: {
    initiator_role: 'buyer' | 'seller' | 'broker';
    initiator_id: string;
    receiver_id?: string;

    title: string;
    description: string;
    acceptance_criteria?: string;

    amount: number;
    currency: string;

    inspection_period: string; // e.g. "3 days"
    delivery_date: string; // YYYY-MM-DD
    who_pay_fees: 'buyer' | 'seller' | 'both';

    dispute_window?: string;
    how_dispute_is_handled?: 'platform' | 'arbitration';

    buyer_details: {
      name: string;
      email: string;
      phone: string;
    };

    seller_details: {
      name: string;
      email: string;
      phone: string;
    };

    callback_url?: string;
  }) {
    try {
      const payload = {
        uuid: uuidv4(),
        escrow_type: 'onetime',
        initiator_role: params.initiator_role,
        initiator_id: params.initiator_id,
        receiver_id: params.receiver_id ?? null,

        title: params.title,
        description: params.description,
        acceptance_criteria: params.acceptance_criteria ?? null,

        currency: params.currency,
        amount: params.amount,

        inspection_period: params.inspection_period,
        delivery_date: params.delivery_date,
        who_pay_fees: params.who_pay_fees,

        dispute_window: params.dispute_window ?? null,
        how_dispute_is_handled: params.how_dispute_is_handled ?? 'platform',

        buyer_details: params.buyer_details,
        seller_details: params.seller_details,

        payout: {
          payout_type: 'bank',
        },

        callback_url: params.callback_url ?? null,
      };

      const response = await firstValueFrom(
        this.http.post(`${this.baseUrl}/escrow/initialize`, payload, {
          headers: {
            Token: this.token,
            'Content-Type': 'application/json',
          },
        }),
      );

      return response.data;
    } catch (err: any) {
      throw new InternalServerErrorException(
        err?.response?.data ?? 'Pandascrow escrow initialization failed',
      );
    }
  }

  /* ────────────────────────────────────────────────
     MARK ESCROW AS COMPLETE (OTP CONFIRMATION)
     POST /escrow/complete
  ──────────────────────────────────────────────── */
  async completeEscrow(params: {
    escrow_id: number;
    uuid: string; // user UUID confirming
    otp: string;
  }) {
    try {
      const payload = {
        escrow_id: params.escrow_id,
        uuid: params.uuid,
        otp: params.otp,
      };

      const response = await firstValueFrom(
        this.http.post(`${this.baseUrl}/escrow/complete`, payload, {
          headers: {
            Token: this.token,
            'Content-Type': 'application/json',
          },
        }),
      );

      return response.data;
    } catch (err: any) {
      throw new BadRequestException(
        err?.response?.data ?? 'Pandascrow escrow completion failed',
      );
    }
  }
}
