import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
import { GeoService } from './geo.service';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';

@ApiTags('Geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Throttle({ default: { limit: 1, ttl: 1 } })
  @Get('reverse')
  @ApiOperation({
    summary: 'Reverse geocode coordinates',
    description:
      'Resolves a lat/lon pair to a Nigerian state via Nominatim (OpenStreetMap). Rate limited to 1 request per second.',
  })
  @ApiQuery({ name: 'lat', required: true, example: 6.5244 })
  @ApiQuery({ name: 'lon', required: true, example: 3.3792 })
  @ApiOkResponse({
    description: 'Reverse geocoding result',
    schema: { example: { success: true, data: { state: 'Lagos' } } },
  })
  @ApiStandardErrorResponses()
  async reverse(@Query() dto: ReverseGeocodeDto) {
    const result = await this.geoService.reverseGeocode(dto.lat, dto.lon);
    return { success: true, data: result };
  }
}
