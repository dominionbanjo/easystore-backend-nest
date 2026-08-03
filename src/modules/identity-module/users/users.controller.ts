import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
import {
  SuccessResponseDto,
  SuccessWithIdDto,
} from '../../../common/dto/api-response.dto';
import { UsersService } from './users.service';
import { UpdateProfileDto, AddressDto } from './dto/update-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { mapToOwnerStore } from 'src/modules/vendor-module/store/utils/store-sanitizer.util';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the profile of the currently authenticated user.',
  })
  @ApiOkResponse({ description: 'User profile returned' })
  @ApiStandardErrorResponses()
  async getMe(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.usersService.getProfile(user.sub);
  }

  @Patch('me')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiOperation({
    summary: 'Update user profile',
    description:
      'Updates the authenticated user profile, including optional avatar upload.',
  })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Profile updated successfully',
  })
  @ApiStandardErrorResponses()
  async updateProfile(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() body: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(user.sub, body, file);
  }

  @Get('me/stores')
  @ApiOperation({
    summary: 'Get user stores',
    description: 'Returns all stores owned by the authenticated user.',
  })
  @ApiOkResponse({ description: 'User stores returned' })
  @ApiStandardErrorResponses()
  async getUserStores(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    const stores = await this.usersService.getStores(user.sub);
    return stores.map((s) => mapToOwnerStore(s));
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'List all users (admin)',
    description: 'Returns a paginated list of all users. Admin only.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiOkResponse({ description: 'Paginated list of users returned' })
  @ApiStandardErrorResponses()
  async getAllUsers(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.getAllUsers({
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Post('bank/register')
  @ApiOperation({
    summary: 'Register bank account',
    description:
      'Registers a Paystack bank account for the authenticated user.',
  })
  @ApiBody({ description: 'Bank account details', type: Object })
  @ApiCreatedResponse({
    type: SuccessResponseDto,
    description: 'Bank account registered successfully',
  })
  @ApiStandardErrorResponses()
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

  @Delete('bank')
  @ApiOperation({
    summary: 'Delete bank account',
    description:
      'Deletes the registered bank account for the authenticated user.',
  })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Bank account deleted successfully',
  })
  @ApiStandardErrorResponses()
  async deleteBankAccount(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.usersService.deleteBankAccount(user.sub);
  }

  @Post('me/addresses')
  @ApiOperation({
    summary: 'Add user address',
    description: 'Adds a new address to the authenticated user profile.',
  })
  @ApiCreatedResponse({
    type: SuccessWithIdDto,
    description: 'Address added successfully',
  })
  @ApiStandardErrorResponses()
  async addAddress(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() body: AddressDto,
  ) {
    return this.usersService.addUserAddress(user.sub, body);
  }

  @Patch('me/addresses/:id')
  @ApiOperation({
    summary: 'Update user address',
    description: 'Updates an existing address for the authenticated user.',
  })
  @ApiParam({ name: 'id', description: 'Address ID', type: String })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Address updated successfully',
  })
  @ApiStandardErrorResponses()
  async updateAddress(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') id: string,
    @Body() body: AddressDto,
  ) {
    return this.usersService.updateUserAddress(user.sub, id, body);
  }

  @Delete('me/addresses/:id')
  @ApiOperation({
    summary: 'Delete user address',
    description: 'Deletes an address from the authenticated user profile.',
  })
  @ApiParam({ name: 'id', description: 'Address ID', type: String })
  @ApiOkResponse({
    type: SuccessResponseDto,
    description: 'Address deleted successfully',
  })
  @ApiStandardErrorResponses()
  async deleteAddress(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('id') id: string,
  ) {
    return this.usersService.deleteUserAddress(user.sub, id);
  }
}
