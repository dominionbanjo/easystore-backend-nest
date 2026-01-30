import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { PaystackService } from '../services/paystack.service';

@Controller('payments/paystack')
export class PaystackController {
  constructor(private readonly paystack: PaystackService) {}
  /* ────────────────────────────────────────────────
   GET NIGERIAN BANKS
   GET /payments/paystack/banks
──────────────────────────────────────────────── */
  @Get('banks')
  async getBanks() {
    return this.paystack.getBanksNigeria();
  }

  /* ────────────────────────────────────────────────
     INITIALIZE PAYMENT (CLIENT → PAYSTACK)
     POST /payments/paystack/initialize
  ──────────────────────────────────────────────── */
  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  async initializePayment(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body()
    body: {
      email: string;
      amount: number;
    },
  ) {
    if (!body.email || !body.amount) {
      throw new BadRequestException('Email and amount are required');
    }

    return this.paystack.initializePayment(body.email, body.amount);
  }

  /* ────────────────────────────────────────────────
     VERIFY PAYMENT (MANUAL / ADMIN / CALLBACK)
     GET /payments/paystack/verify?reference=xxx
  ──────────────────────────────────────────────── */
  @Get('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async verifyPayment(@Query('reference') reference: string) {
    if (!reference) {
      throw new BadRequestException('Payment reference is required');
    }

    return this.paystack.verifyPayment(reference);
  }

  /* ────────────────────────────────────────────────
     VERIFY BANK ACCOUNT
     POST /payments/paystack/bank/verify
  ──────────────────────────────────────────────── */
  @Post('bank/verify')
  @UseGuards(JwtAuthGuard)
  async verifyBankAccount(
    @Body()
    body: {
      account_number: string;
      bank_code: string;
    },
  ) {
    if (!body.account_number || !body.bank_code) {
      throw new BadRequestException(
        'Account number and bank code are required',
      );
    }

    return this.paystack.verifyBankAccount(body.account_number, body.bank_code);
  }

  /* ────────────────────────────────────────────────
     CREATE TRANSFER RECIPIENT (VENDOR PAYOUT SETUP)
     POST /payments/paystack/recipient
  ──────────────────────────────────────────────── */
  @Post('recipient')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  async createTransferRecipient(
    @Body()
    body: {
      name: string;
      account_number: string;
      bank_code: string;
    },
  ) {
    if (!body.name || !body.account_number || !body.bank_code) {
      throw new BadRequestException('Missing recipient details');
    }

    return this.paystack.createTransferRecipient(body);
  }

  /* ────────────────────────────────────────────────
     INITIATE TRANSFER (ADMIN ONLY)
     POST /payments/paystack/transfer
  ──────────────────────────────────────────────── */
  @Post('transfer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async initiateTransfer(
    @Body()
    body: {
      recipient_code: string;
      amount: number;
      reason: string;
    },
  ) {
    if (!body.recipient_code || !body.amount || !body.reason) {
      throw new BadRequestException('Missing transfer parameters');
    }

    return this.paystack.initiateTransfer(body);
  }
}
