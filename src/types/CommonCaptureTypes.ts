export default interface CommonCaptureTypes {
  total: number;
  fee?: number;
  tax?: number;
  currency?: string;
  transactionId: string;
  orderId?: string;
}
