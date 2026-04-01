import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from './interfaces/payment-provider.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly configService: ConfigService,
  ) {}

  async createPayment(accountId: string, dto: CreatePaymentDto) {
    const returnUrl = this.configService.get<string>(
      'YOOMONEY_RETURN_URL',
      'http://localhost:5173/wallet',
    );

    const { externalId, redirectUrl } = await this.provider.createPayment({
      amount: dto.amount,
      description: dto.description || 'Пополнение баланса',
      returnUrl,
      metadata: { accountId },
    });

    const payment = await this.prisma.payment.create({
      data: {
        accountId,
        amount: dto.amount,
        status: 'pending',
        externalId,
        redirectUrl,
        provider: 'yoomoney_stub',
      },
    });

    return { paymentId: payment.id, redirectUrl: payment.redirectUrl };
  }

  async handleWebhook(body: any, headers: Record<string, string>) {
    const isValid = this.provider.verifyWebhook(body, headers);
    if (!isValid) {
      throw new UnauthorizedException('Невалидная подпись вебхука');
    }

    const externalId: string | undefined =
      body.externalId ?? body.object?.id ?? undefined;

    const payment = await this.prisma.payment.findFirst({
      where: { externalId },
    });

    if (!payment) {
      throw new NotFoundException('Платёж не найден');
    }

    if (payment.status !== 'pending') {
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'succeeded' },
    });

    await this.walletService.topUp(
      payment.accountId,
      payment.amount,
      'Пополнение через ЮMoney',
      payment.id,
    );

    this.logger.log(
      `Платёж ${payment.id} (externalId: ${externalId}) успешно обработан, баланс пополнен на ${payment.amount} руб.`,
    );
  }
}
