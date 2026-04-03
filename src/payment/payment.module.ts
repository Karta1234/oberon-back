import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import { YooMoneyStubProvider } from './providers/yoomoney-stub.provider';
import { YooKassaProvider } from './providers/yookassa.provider';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>(
          'PAYMENT_PROVIDER',
          'stub',
        );
        if (provider === 'yookassa') {
          return new YooKassaProvider(configService);
        }
        return new YooMoneyStubProvider(configService);
      },
      inject: [ConfigService],
    },
  ],
})
export class PaymentModule {}
