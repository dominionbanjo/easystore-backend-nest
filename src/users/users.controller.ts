import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ------------------------------------------------------------------
  // GET CURRENT LOGGED-IN USER
  // ------------------------------------------------------------------
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    return this.usersService.getProfile(req.user.sub);
  }

  // ------------------------------------------------------------------
  // UPDATE PROFILE (form-data + avatar upload)
  // ------------------------------------------------------------------
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async updateProfile(
    @Req() req: any,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Parse address JSON if included
    if (typeof body.address === 'string') {
      try {
        body.address = JSON.parse(body.address);
      } catch {
        throw new BadRequestException('Invalid address JSON format');
      }
    }

    return this.usersService.updateProfile(req.user.sub, body, file);
  }

  // ------------------------------------------------------------------
  // GET USER STORES
  // ------------------------------------------------------------------
  @Get('me/stores')
  @UseGuards(JwtAuthGuard)
  async getUserStores(@Req() req: any) {
    return this.usersService.getStores(req.user.sub);
  }

  // ------------------------------------------------------------------
  // ADMIN: GET ALL USERS (PAGINATED)
  // ------------------------------------------------------------------
  @Get()
  async getAllUsers(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.getAllUsers(Number(page), Number(limit));
  }

  // ------------------------------------------------------------------
  // REGISTER BANK ACCOUNT (PAYSTACK)
  // ------------------------------------------------------------------
  @Post('bank/register')
  @UseGuards(JwtAuthGuard)
  async registerBankAccount(
    @Req() req: any,
    @Body()
    body: {
      bank_code: string;
      account_number: string;
      settlement_email?: string;
    },
  ) {
    const { bank_code, account_number, settlement_email } = body;

    if (!bank_code || !account_number) {
      throw new BadRequestException(
        'bank_code and account_number are required',
      );
    }

    return this.usersService.registerBankAccount(
      req.user.sub,
      bank_code,
      account_number,
      settlement_email,
    );
  }

  // ------------------------------------------------------------------
  // UPDATE BANK ACCOUNT
  // ------------------------------------------------------------------
  @Patch('bank/update')
  @UseGuards(JwtAuthGuard)
  async updateBankAccount(
    @Req() req: any,
    @Body()
    body: {
      account_number?: string;
      bank_code?: string;
      settlement_email?: string;
    },
  ) {
    if (!body.account_number && !body.bank_code && !body.settlement_email) {
      throw new BadRequestException('Provide at least one field to update');
    }

    return this.usersService.updateBankAccount(req.user.sub, body);
  }

  // ------------------------------------------------------------------
  // DELETE BANK ACCOUNT
  // ------------------------------------------------------------------
  @Delete('bank')
  @UseGuards(JwtAuthGuard)
  async deleteBankAccount(@Req() req: any) {
    return this.usersService.deleteBankAccount(req.user.sub);
  }
}
