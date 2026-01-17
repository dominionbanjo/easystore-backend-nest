export interface MonthlySales {
  month: string;
  year: number;
  amount: number;
}

export interface MonthlyOrder {
  month: string;
  year: number;
  count: number;
}

export interface MonthlyCustomer {
  month: string;
  year: number;
  count: number;
  list: string[];
}

export interface StoreAnalytics {
  sales: MonthlySales[];
  orders: MonthlyOrder[];
  customers: MonthlyCustomer[];
}

export interface StoreCustomer {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  location: string | null;
  orders: number;
  spent: number;
  rating: number;
  last_order_date: string | null;
}

export interface UpdateBankAccountDto {
  account_number?: string;
  bank_code?: string;
  settlement_email?: string;
}

export interface VerifiedBankInfo {
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_id: any;
}
