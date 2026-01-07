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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/auth/strategies/jwt.strategy';
import { UpdateProfileDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ------------------------------------------------------------------
  // GET CURRENT LOGGED-IN USER
  // ------------------------------------------------------------------
  @Get('me')
  async getMe(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.usersService.getProfile(user.sub);
  }

  // ------------------------------------------------------------------
  // UPDATE PROFILE (form-data + avatar upload)
  // ------------------------------------------------------------------
  @Patch('me')
  @UseInterceptors(FileInterceptor('avatar'))
  async updateProfile(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() body: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(user.sub, body, file);
  }

  // ------------------------------------------------------------------
  // GET USER STORES
  // ------------------------------------------------------------------
  @Get('me/stores')
  async getUserStores(@Req() req: any) {
    return this.usersService.getStores(req.user.sub);
  }

  // ------------------------------------------------------------------
  // ADMIN: GET ALL USERS (PAGINATED)
  // ------------------------------------------------------------------
  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getAllUsers(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.getAllUsers({
      page: Number(page),
      limit: Number(limit),
    });
  }

  // ------------------------------------------------------------------
  // REGISTER BANK ACCOUNT (PAYSTACK)
  // ------------------------------------------------------------------
  @Post('bank/register')
  async registerBankAccount(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
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
      user.sub,
      bank_code,
      account_number,
      settlement_email,
    );
  }

  // ------------------------------------------------------------------
  // DELETE BANK ACCOUNT
  // ------------------------------------------------------------------
  @Delete('bank')
  async deleteBankAccount(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.usersService.deleteBankAccount(user.sub);
  }
}
