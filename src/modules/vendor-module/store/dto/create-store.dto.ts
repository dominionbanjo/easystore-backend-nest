export class CreateStoreDto {
  user_id: string;
  store_name: string;
  email: string;

  category?: string | null;
  description?: string | null;

  phone_number?: string | null;
  website?: string | null;

  /* ADDRESS */
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_country?: string | null;
  address_postal_code?: string | null;
  setup_stage?: number;
}
