export interface CreatePaymentRequest {
  amount: number;
  description: string;
  returnUrl: string;
  metadata?: Record<string, any>;
}

export interface CreatePaymentResponse {
  externalId: string;
  redirectUrl: string;
}

export interface PaymentProvider {
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;
  verifyWebhook(body: any, headers: Record<string, string>): boolean;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
