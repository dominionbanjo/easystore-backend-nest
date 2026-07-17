import { Test, TestingModule } from '@nestjs/testing';
import { ProductReviewController } from './review.controller';
import { ProductReviewService } from './review.service';

describe('ProductReviewController', () => {
  let controller: ProductReviewController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductReviewController],
      providers: [ProductReviewService],
    }).compile();

    controller = module.get<ProductReviewController>(ProductReviewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
