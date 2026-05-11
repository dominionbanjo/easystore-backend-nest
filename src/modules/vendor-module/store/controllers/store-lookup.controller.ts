import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { StoreService } from '../services/store.service';

@Controller('store/lookup')
export class StoreLookupController {
  constructor(private readonly storeService: StoreService) {}

  /* ────────────────────────────────────────────────
     LOOKUP ROUTES
  ──────────────────────────────────────────────── */

  // GET /store/lookup/check-name?name=My Store
  @Get('check-name')
  async checkStoreName(@Query('name') name: string) {
    if (!name || name.trim().length < 2) {
      throw new BadRequestException('Store name is required');
    }

    const exists = await this.storeService.storeNameExists(name);

    return exists;
  }

  // GET /store/lookup/check-subdomain?subdomain=my-subdomain&storeId=123
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
