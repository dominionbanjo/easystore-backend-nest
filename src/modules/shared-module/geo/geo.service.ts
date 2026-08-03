import { Injectable, Logger } from '@nestjs/common';

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const GEOCODE_TIMEOUT_MS = 8_000;

interface NominatimReverseResponse {
  address?: { state?: string };
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  async reverseGeocode(
    lat: number,
    lon: number,
  ): Promise<{ state: string | null }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

      const url = `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${lat}&lon=${lon}`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'EasyStore/1.0 (https://eazystore.com.ng)',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(
          `Nominatim reverse geocode failed with status ${response.status}`,
        );
        return { state: null };
      }

      const data = (await response.json()) as NominatimReverseResponse;
      return { state: data.address?.state ?? null };
    } catch (error: unknown) {
      this.logger.warn(
        `Nominatim reverse geocode error: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return { state: null };
    }
  }
}
