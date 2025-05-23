export interface CommonTransactionType {
  amount: number;
  currency?: string;
  tax?: number;
  shipping?: number;
  discount?: number;
  ccnumber?: string;
  ccexp?: {
    month: string;
    year: string;
  };
  cvv?: string;
  first_name?: string;
  last_name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  shipping_firstname?: string;
  shipping_lastname?: string;
  shipping_address1?: string;
  shipping_address2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_zip?: string;
  shipping_country?: string;
  shipping_phone?: string;
  customer_receipt?: boolean;
  type?: string;
  transactionType?: 'auth' | 'authcapture'; // Added field for transaction type
}
