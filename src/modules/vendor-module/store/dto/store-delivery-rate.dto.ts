export class SetProductDeliveryRateDto {
  country: string;
  state?: string;
  city?: string;
  price: number;
  estimated_days?: number;
}
