import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(@Req() req: Request & { user: { id: string } }) {
    const balance = await this.walletService.getBalance(req.user.id);
    return { balance: balance.toFixed(2) };
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  async getTransactions(
    @Req() req: Request & { user: { id: string } },
    @Query() query: TransactionsQueryDto,
  ) {
    return this.walletService.getTransactions(req.user.id, query.page ?? 1, query.limit ?? 20);
  }
}
