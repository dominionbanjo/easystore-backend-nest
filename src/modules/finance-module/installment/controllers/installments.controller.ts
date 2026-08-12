import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { InstallmentService } from '../services/installment.service';
import {
  CreateInstallmentPlanDto,
  ListInstallmentsDto,
} from '../dto/installment.dto';
import {
  InstallmentConfigDto,
  InstallmentPaymentInitResponseDto,
  InstallmentPlanDetailDto,
  InstallmentPlanListItemDto,
  InstallmentSimpleResponseDto,
} from '../dto/installment-response.dto';

@ApiTags('Installments')
@ApiBearerAuth('JWT-auth')
@Controller('installments')
@UseGuards(JwtAuthGuard)
export class InstallmentsController {
  constructor(private readonly installments: InstallmentService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Get installment presets and guardrails',
    description:
      'Returns the platform-defined payment presets and eligibility guardrails (min order value, max concurrent plans, default lockout).',
  })
  @ApiOkResponse({ type: InstallmentConfigDto })
  @ApiStandardErrorResponses()
  getConfig() {
    return this.installments.getConfig();
  }

  @Post()
  @ApiOperation({
    summary: 'Create an installment plan for an order',
    description:
      'Wraps a pending order in an installment plan. Reserves the ordered stock, creates the escrow hold and charges the first installment (deposit) immediately via Paystack. Returns the deposit payment URL.',
  })
  @ApiCreatedResponse({
    type: InstallmentPaymentInitResponseDto,
    description:
      'Plan created — redirect the buyer to payment_url to pay the deposit.',
  })
  @ApiStandardErrorResponses()
  async createPlan(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateInstallmentPlanDto,
  ) {
    return this.installments.createPlan({
      buyer_id: user.sub,
      order_id: dto.order_id,
      preset_id: dto.preset_id,
      mode: dto.mode,
    });
  }

  @Get('mine')
  @ApiOperation({
    summary: 'List my installment plans',
    description:
      'Paginated list of the authenticated buyer’s installment plans.',
  })
  @ApiPaginatedResponse(InstallmentPlanListItemDto)
  @ApiStandardErrorResponses()
  listMine(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query() query: ListInstallmentsDto,
  ) {
    return this.installments.listMyPlans(user.sub, query.page, query.limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one of my installment plans',
    description:
      'Returns a single plan owned by the authenticated buyer, including every installment payment row.',
  })
  @ApiParam({ name: 'id', description: 'Installment plan ID', type: String })
  @ApiOkResponse({ type: InstallmentPlanDetailDto })
  @ApiStandardErrorResponses()
  getOne(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') id: string,
  ) {
    return this.installments.getMyPlan(id, user.sub);
  }

  @Post(':id/pay')
  @ApiOperation({
    summary: 'Pay the next pending installment',
    description:
      'Initializes a fresh Paystack payment for the next due installment (manual mode). Returns the payment URL to redirect the buyer to.',
  })
  @ApiParam({ name: 'id', description: 'Installment plan ID', type: String })
  @ApiCreatedResponse({
    type: InstallmentPaymentInitResponseDto,
    description: 'Payment initialized — redirect buyer to payment_url.',
  })
  @ApiStandardErrorResponses()
  payInstallment(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') id: string,
  ) {
    return this.installments.payInstallment({
      plan_id: id,
      buyer_id: user.sub,
    });
  }

  @Post(':id/payoff')
  @ApiOperation({
    summary: 'Pay the remaining balance in one go',
    description:
      'Charges the outstanding plan balance as a single final installment. The plan completes and the order moves to paid once the payment is verified.',
  })
  @ApiParam({ name: 'id', description: 'Installment plan ID', type: String })
  @ApiCreatedResponse({
    type: InstallmentPaymentInitResponseDto,
    description: 'Payoff payment initialized — redirect buyer to payment_url.',
  })
  @ApiStandardErrorResponses()
  payoff(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') id: string,
  ) {
    return this.installments.payoff({
      plan_id: id,
      buyer_id: user.sub,
    });
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a plan (all paid money is refunded)',
    description:
      'Voluntarily cancels an active plan. Every paid installment is refunded to the buyer’s original payment method via Paystack, the reserved stock is released and the order is canceled.',
  })
  @ApiParam({ name: 'id', description: 'Installment plan ID', type: String })
  @ApiOkResponse({
    type: InstallmentSimpleResponseDto,
    description: 'Plan canceled and refunds initiated.',
  })
  @ApiStandardErrorResponses()
  cancel(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') id: string,
  ) {
    return this.installments.cancelPlan({ plan_id: id, buyer_id: user.sub });
  }
}
