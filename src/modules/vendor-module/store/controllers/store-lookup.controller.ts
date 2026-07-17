import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '../../../../common/decorators/api-standard-errors.decorator';
import { StoreService } from '../services/store.service';

@ApiTags('Store Lookup')
@Controller('store/lookup')
export class StoreLookupController {
  constructor(private readonly storeService: StoreService) {}

  /* ────────────────────────────────────────────────
     LOOKUP ROUTES
  ──────────────────────────────────────────────── */

  @ApiOperation({ summary: 'Check store name availability', description: 'Check if a store name is already taken' })
  @ApiQuery({ name: 'name', required: true, type: String, description: 'Store name to check' })
  @ApiOkResponse({ description: 'Name availability result' })
  @ApiStandardErrorResponses()
  @Get('check-name')
  async checkStoreName(@Query('name') name: string) {
    if (!name || name.trim().length < 2) {
      throw new BadRequestException('Store name is required');
    }

    const exists = await this.storeService.storeNameExists(name);

    return exists;
  }

  @ApiOperation({ summary: 'Check subdomain availability', description: 'Check if a subdomain is available for registration' })
  @ApiQuery({ name: 'subdomain', required: true, type: String, description: 'Subdomain to check' })
  @ApiQuery({ name: 'storeId', required: false, type: String, description: 'Store ID to exclude from check' })
  @ApiOkResponse({ description: 'Subdomain availability result' })
  @ApiStandardErrorResponses()
  @Get('check-subdomain')
  async checkSubdomain(
    @Query('subdomain') subdomain: string,
    @Query('storeId') storeId?: string,
  ) {
    if (!subdomain || subdomain.trim().length < 2) {
      throw new BadRequestException('Subdomain name is required');
    }

    const result = await this.storeService.checkSubdomainAvailability(
      subdomain,
      storeId,
    );

    return result;
  }
}
