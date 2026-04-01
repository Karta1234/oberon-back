import { Module } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { GenerationController } from './generation.controller';
import { PolzaApiService } from './polza-api.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [GenerationController],
  providers: [GenerationService, PolzaApiService],
})
export class GenerationModule {}
