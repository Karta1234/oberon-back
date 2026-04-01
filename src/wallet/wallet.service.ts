import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from 'generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(accountId: string): Promise<Decimal> {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { balance: true },
    });
    return account.balance;
  }

  async hasBalance(accountId: string, amount: Decimal | number): Promise<boolean> {
    const balance = await this.getBalance(accountId);
    return balance.greaterThanOrEqualTo(new Decimal(amount));
  }

  async topUp(
    accountId: string,
    amount: Decimal | number,
    description: string,
    paymentId?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { increment: amount } },
      });
      await tx.transaction.create({
        data: {
          accountId,
          type: TransactionType.top_up,
          amount: new Decimal(amount),
          description,
          paymentId,
        },
      });
    });
  }

  async charge(
    accountId: string,
    amount: Decimal | number,
    description: string,
    generationId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findUniqueOrThrow({ where: { id: accountId } });
      if (account.balance.lessThan(new Decimal(amount))) {
        throw new BadRequestException('Недостаточно средств');
      }
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { decrement: amount } },
      });
      await tx.transaction.create({
        data: {
          accountId,
          type: TransactionType.charge,
          amount: new Decimal(amount),
          description,
          generationId,
        },
      });
    });
  }

  async refund(
    accountId: string,
    amount: Decimal | number,
    description: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { increment: amount } },
      });
      await tx.transaction.create({
        data: {
          accountId,
          type: TransactionType.refund,
          amount: new Decimal(amount),
          description,
        },
      });
    });
  }

  async getTransactions(accountId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where: { accountId } }),
    ]);
    return { items, total, page, limit };
  }
}
