/**
 * @description PayNetWorx API Type Definitions
 * @version 1.0.0
 * @since 2.0.0
 */

export interface PaynetworxAuthType {
  Amount: {
    //all amounts of the transaction, must be a decimal number with two decimal places
    Total: string;
    Fee?: string; //Fee: "0.00";
    Tax?: string; //Tax: "0.00";
    Taxable?: string;
    Shipping?: string;
    Duty?: string;
    Discount?: string;
    Cashback?: string;
    Currency: string; //Currency: "USD";
  };
  PaymentMethod: {
    Card: {
      CardPresent: boolean;
      CVC: {
        CVC?: string;
      };
      PAN: {
        PAN: string;
        ExpMonth: string;
        ExpYear: string;
      };
      BillingAddress: {
        Name?: string;
        Line1?: string;
        Line2?: string;
        City?: string;
        State?: string;
        PostalCode?: string;
        Country?: string;
        Phone?: string;
        Email?: string;
      };
    };
  };
  POS?: {
    EntryMode?: 'card-on-file' | 'manual' | 'manual-fallback' | 'magstripe' | 'magstripe-fallback' | 'chip' | 'contactless-chip';
    Type?: 'pos' | 'recurring' | 'ecommerce';
    Device: string;
    DeviceVersion: string;
    Application: string;
    ApplicationVersion: string;
    Timestamp: string;
  };
  Detail?: {
    MerchantData?: {
      // this can be any number of key value pairs, as defined by the merchant
      // example: "invoice": "12345" or "OrderNumber": "12345"
      [key: string]: string;
    };
  };
}

export interface PaynetworxCaptureType {
  Amount: {
    Total: number;
    Fee?: number;
    Tax?: number;
    Currency: string;
  };
  TransactionID: string;
  Detail: {
    MerchantData: {
      // Additional merchant-specific data can be included here
      [key: string]: any;
    };
  };
}

export interface PaynetworxRefundType {
  Amount: {
    Total: string;
    Currency: string;
  };
  TransactionID: string;
  Detail: {
    MerchantData: {
      // Additional merchant-specific data can be included here
      [key: string]: any;
    };
  };
}

export interface PaynetworxVoidTypes {
  TransactionID: string;
  Reason: string;
  Detail?: {
    MerchantData?: {
      [key: string]: string;
    };
  };
}

export interface PaynetworxVaultType {
  PaymentMethod: {
    Card: {
      CardPresent: boolean;
      CVC: {
        CVC?: string;
      };
      PAN: {
        PAN: string;
        ExpMonth: string;
        ExpYear: string;
      };
      BillingAddress: {
        Name?: string;
        Line1?: string;
        Line2?: string;
        City?: string;
        State?: string;
        PostalCode?: string;
        Country?: string;
        Phone?: string;
        Email?: string;
      };
    };
  };
  DataAction: string;
  Attributes: {
    EntryMode: string;
    ProcessingSpecifiers: {
      InitiatedByECommerce: boolean;
    };
  };
  TransactionEntry: {
    Device: string;
    DeviceVersion: string;
    Application: string;
    ApplicationVersion: string;
    Timestamp: string;
  };
  Detail: {
    MerchantData: {
      CustomerID?: string;
      OrderNumber?: string;
      TrackingID?: string;
      [key: string]: any;
    };
  };
}

export interface PaynetworxTokenType {
  Amount: {
    Total: string;
    Currency: string;
  };
  PaymentMethod: {
    Token: {
      TokenID: string;
    };
  };
  Detail: {
    MerchantData: {
      OrderNumber?: string;
      TrackingID?: string;
      CustomerID?: string;
      [key: string]: any;
    };
  };
  Attributes?: {
    EntryMode?: string;
    ProcessingSpecifiers?: {
      InitiatedByECommerce?: boolean;
      InitiatedByVirtualTerminal?: boolean;
    };
  };
}
