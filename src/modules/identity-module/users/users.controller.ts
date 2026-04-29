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
import { UpdateProfileDto } from './dto/update-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { mapToOwnerStore } from 'src/modules/vendor-module/store/utils/store-sanitizer.util';

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
  async getUserStores(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    const stores = await this.usersService.getStores(user.sub);
    return stores.map((s) => mapToOwnerStore(s));
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

  // ------------------------------------------------------------------
  // MULTI-ADDRESS MANAGEMENT
  // ------------------------------------------------------------------
  @Post('me/addresses')
  async addAddress(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() body: any,
  ) {
    return this.usersService.addUserAddress(user.sub, body);
  }

  @Patch('me/addresses/:id')
  async updateAddress(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.usersService.updateUserAddress(user.sub, id, body);
  }

  @Delete('me/addresses/:id')
  async deleteAddress(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') id: string,
  ) {
    return this.usersService.deleteUserAddress(user.sub, id);
  }
}
