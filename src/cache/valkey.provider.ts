import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const ValkeyClientProvider: Provider = {
  provide: 'VALKEY_CLIENT',
  useFactory: () => {
    const url = process.env.VALKEY_URL;
    const isDev = process.env.NODE_ENV === 'development';

    if (!url || isDev) {
      console.warn('⚠ Valkey disabled (dev mode or missing VALKEY_URL)');
      return null;
    }

    try {
      const client = new Redis(url, {
        enableReadyCheck: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        tls: url.startsWith('rediss://')
          ? { rejectUnauthorized: false }
          : undefined,
      });

      client.on('connect', () => console.log('🔌 Valkey connected'));
      client.on('error', (err) => console.log('⚠ Valkey error:', err.message));

      return client;
    } catch (error) {
      console.warn('❌ Valkey initialization failed');
      return null;
    }
  },
};
