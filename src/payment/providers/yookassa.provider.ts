import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentProvider,
} from '../interfaces/payment-provider.interface';

const YOOKASSA_ALLOWED_IPS = [
  // IPv4 ranges (CIDR notation expanded is checked via prefix match)
  '185.71.76.',
  '185.71.77.',
  '77.75.153.',
  '77.75.154.',
  '77.75.156.35',
  '77.75.156.11',
];

const YOOKASSA_ALLOWED_IPV6_PREFIX = '2a02:5180:';

@Injectable()
export class YooKassaProvider implements PaymentProvider {
  private readonly logger = new Logger(YooKassaProvider.name);
  private readonly shopId: string;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.shopId = this.configService.getOrThrow<string>('YOOKASSA_SHOP_ID');
    this.secretKey = this.configService.getOrThrow<string>(
      'YOOKASSA_SECRET_KEY',
    );
  }

  async createPayment(
    request: CreatePaymentRequest,
  ): Promise<CreatePaymentResponse> {
    const idempotencyKey = crypto.randomUUID();

    const body = {
      amount: {
        value: request.amount.toFixed(2),
        currency: 'RUB',
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: request.returnUrl,
      },
      description: request.description,
      metadata: request.metadata,
    };

    const credentials = Buffer.from(
      `${this.shopId}:${this.secretKey}`,
    ).toString('base64');

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
        'Idempotence-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `ЮKassa createPayment failed: ${response.status} ${text}`,
      );
      throw new Error(`ЮKassa API error: ${response.status} ${text}`);
    }

    const data = (await response.json()) as {
      id: string;
      confirmation?: { confirmation_url?: string };
    };

    const externalId = data.id;
    const redirectUrl = data.confirmation?.confirmation_url ?? '';

    if (!redirectUrl) {
      this.logger.error(
        `ЮKassa: no confirmation_url in response: ${JSON.stringify(data)}`,
      );
      throw new Error('ЮKassa API не вернул URL для оплаты');
    }

    this.logger.log(
      `Создан платёж ЮKassa: ${externalId} на сумму ${request.amount} руб.`,
    );

    return { externalId, redirectUrl };
  }

  verifyWebhook(body: any, headers: Record<string, string>): boolean {
    const ip =
      headers['x-real-ip'] ||
      (headers['x-forwarded-for'] || '').split(',')[0].trim();

    if (!ip) {
      this.logger.warn('Webhook без IP-адреса отправителя');
      return false;
    }

    const isAllowed =
      YOOKASSA_ALLOWED_IPS.some((prefix) => ip.startsWith(prefix)) ||
      ip.startsWith(YOOKASSA_ALLOWED_IPV6_PREFIX);

    if (!isAllowed) {
      this.logger.warn(`Webhook с неразрешённого IP: ${ip}`);
      return false;
    }

    return true;
  }
}
