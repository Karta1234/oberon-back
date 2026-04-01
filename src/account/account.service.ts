import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {}

  create(data: { email: string; password?: string; name?: string }) {
    return this.prisma.account.create({ data });
  }

  findByEmail(email: string) {
    return this.prisma.account.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.account.findUnique({ where: { id } });
  }

  findOAuthProvider(provider: string, providerUserId: string) {
    return this.prisma.oAuthProvider.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
    });
  }

  createOAuthProvider(data: {
    accountId: string;
    provider: string;
    providerUserId: string;
  }) {
    return this.prisma.oAuthProvider.create({ data });
  }
}
