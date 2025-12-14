import { Test, TestingModule } from '@nestjs/testing';
import { StoreAnalyticsService } from './store-analytics.service';

describe('StoreAnalyticsService', () => {
  let service: StoreAnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StoreAnalyticsService],
    }).compile();

    service = module.get<StoreAnalyticsService>(StoreAnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
