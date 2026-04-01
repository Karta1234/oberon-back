import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { AccountService } from 'src/account/account.service';
import { hash, compare } from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';

export interface OAuthProfile {
  provider: string;
  providerUserId: string;
  email: string;
  name?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private accountService: AccountService,
    private jwtService: JwtService,
  ) {}
  async register(dto: RegisterDto) {
    const exitsing = await this.accountService.findByEmail(dto.email);
    if (exitsing) throw new ConflictException('email уже занят');

    const hashedPassword = await hash(dto.password, 10);
    const account = await this.accountService.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = account;
    return result;
  }
  async login(dto: LoginDto) {
    const user = await this.accountService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Неверные данные');

    if (!user.password) {
      throw new UnauthorizedException(
        'Этот аккаунт использует вход через OAuth. Войдите через Google или Яндекс.',
      );
    }

    const isMatch = await compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Неверные данные');

    // payload для JWT
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { token, user: { id: user.id, email: user.email, name: user.name } };
  }

  async oauthLogin(profile: OAuthProfile) {
    const { provider, providerUserId, email, name } = profile;

    // 1. Найден OAuthProvider → выпустить JWT для привязанного аккаунта
    const existing = await this.accountService.findOAuthProvider(
      provider,
      providerUserId,
    );
    if (existing) {
      const account = await this.accountService.findById(existing.accountId);
      return this.issueToken(account!);
    }

    // 2. Найден Account по email, но без привязки → привязать
    const accountByEmail = await this.accountService.findByEmail(email);
    if (accountByEmail) {
      await this.accountService.createOAuthProvider({
        accountId: accountByEmail.id,
        provider,
        providerUserId,
      });
      return this.issueToken(accountByEmail);
    }

    // 3. Нет аккаунта → создать Account (без пароля) + OAuthProvider
    const newAccount = await this.accountService.create({ email, name });
    await this.accountService.createOAuthProvider({
      accountId: newAccount.id,
      provider,
      providerUserId,
    });
    return this.issueToken(newAccount);
  }

  private issueToken(account: { id: string; email: string; role: string }) {
    const token = this.jwtService.sign({
      sub: account.id,
      email: account.email,
      role: account.role,
    });
    return { token };
  }
}
