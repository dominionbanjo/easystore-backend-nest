import { Test, TestingModule } from '@nestjs/testing';
import { StoreAnalyticsController } from './store-analytics.controller';

describe('StoreAnalyticsController', () => {
  let controller: StoreAnalyticsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoreAnalyticsController],
    }).compile();

    controller = module.get<StoreAnalyticsController>(StoreAnalyticsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
