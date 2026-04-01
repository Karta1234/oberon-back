import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentProvider,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class YooMoneyStubProvider implements PaymentProvider {
  private readonly logger = new Logger(YooMoneyStubProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const externalId = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const returnUrl = this.configService.get<string>(
      'YOOMONEY_RETURN_URL',
      'http://localhost:5173/wallet',
    );

    this.logger.log(
      `[YooMoney Stub] Создан платёж: ${externalId} на сумму ${request.amount} руб.`,
    );

    const redirectUrl = `${returnUrl}?payment_id=${externalId}&amount=${request.amount}&status=success`;

    return { externalId, redirectUrl };
  }

  verifyWebhook(body: any, headers: Record<string, string>): boolean {
    this.logger.log(
      '[YooMoney Stub] Верификация вебхука (всегда true в режиме заглушки)',
    );
    return true;
  }
}
