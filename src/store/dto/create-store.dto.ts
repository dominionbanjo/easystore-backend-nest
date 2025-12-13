import { IStoreAddress } from '../entities/store.entity';

export class CreateStoreDto {
  user_id: string;
  store_name: string;
  email: string;

  category?: string | null;
  description?: string | null;

  phone_number?: string | null;
  website?: string | null;
  address?: IStoreAddress;
}
