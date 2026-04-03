import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class YandexAuthGuard extends AuthGuard('yandex') {
  handleRequest<T>(err: Error | null, user: T): T {
    if (err || !user) {
      throw new UnauthorizedException('Yandex OAuth failed');
    }
    return user;
  }
}
