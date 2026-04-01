import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import { YooMoneyStubProvider } from './providers/yoomoney-stub.provider';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    {
      provide: PAYMENT_PROVIDER,
      useClass: YooMoneyStubProvider,
    },
  ],
})
export class PaymentModule {}
