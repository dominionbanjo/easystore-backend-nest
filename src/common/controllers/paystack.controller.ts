import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

import { ApiStandardErrorResponses } from '../decorators/api-standard-errors.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { PaystackService } from '../services/paystack.service';

@ApiTags('Payments')
@Controller('payments/paystack')
export class PaystackController {
  constructor(private readonly paystack: PaystackService) {}

  @Get('banks')
  @ApiOperation({
    summary: 'Get list of banks',
    description: 'Retrieve all Nigerian banks from Paystack',
  })
  @ApiOkResponse({
    description: 'List of banks returned',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              code: { type: 'string' },
              slug: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiStandardErrorResponses()
  async getBanks() {
    return this.paystack.getBanksNigeria();
  }

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Initialize payment',
    description:
      'Initializes a Paystack payment transaction for the authenticated user.',
  })
  @ApiBody({ description: 'Payment initialization details', type: Object })
  @ApiCreatedResponse({ description: 'Payment initialized successfully' })
  @ApiStandardErrorResponses()
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

    return this.paystack.initializePayment(
      body.email,
      Math.round(body.amount * 100),
    );
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Verify payment (admin)',
    description: 'Verifies a Paystack payment by reference. Admin only.',
  })
  @ApiQuery({
    name: 'reference',
    required: true,
    type: String,
    description: 'Payment reference',
  })
  @ApiOkResponse({ description: 'Payment verification result returned' })
  @ApiStandardErrorResponses()
  async verifyPayment(@Query('reference') reference: string) {
    if (!reference) {
      throw new BadRequestException('Payment reference is required');
    }

    return this.paystack.verifyPayment(reference);
  }

  @Post('bank/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Verify bank account',
    description:
      'Verifies a Nigerian bank account using account number and bank code.',
  })
  @ApiBody({ description: 'Bank account verification details', type: Object })
  @ApiOkResponse({ description: 'Bank account verification result returned' })
  @ApiStandardErrorResponses()
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

  @Post('recipient')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create transfer recipient',
    description: 'Creates a Paystack transfer recipient for vendor payouts.',
  })
  @ApiBody({ description: 'Recipient details', type: Object })
  @ApiCreatedResponse({
    description: 'Transfer recipient created successfully',
  })
  @ApiStandardErrorResponses()
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

  @Post('transfer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Initiate transfer (admin)',
    description: 'Initiates a Paystack transfer to a recipient. Admin only.',
  })
  @ApiBody({ description: 'Transfer details', type: Object })
  @ApiCreatedResponse({ description: 'Transfer initiated successfully' })
  @ApiStandardErrorResponses()
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

    return this.paystack.initiateTransfer({
      recipient_code: body.recipient_code,
      amountKobo: Math.round(body.amount * 100),
      reason: body.reason,
    });
  }
}
