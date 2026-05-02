export type PaymentMethod = 
  | 'CREDIT_CARD' 
  | 'DEBIT_CARD' 
  | 'PAYPAL' 
  | 'BANK_TRANSFER' 
  | 'CRYPTO';

export type PaymentStatus = 
  | 'PENDING' 
  | 'SUCCESS' 
  | 'FAILED' 
  | 'REFUNDED';

export interface Payment {
  id: string; // UUID
  appointment_id: string; // UUID
  amount: number;
  currency: string;
  payment_method?: PaymentMethod;
  status: PaymentStatus;
  transaction_id?: string;
  payment_gateway?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}
