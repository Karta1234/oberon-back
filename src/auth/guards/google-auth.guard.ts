import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  handleRequest<T>(err: Error | null, user: T): T {
    if (err || !user) {
      throw new UnauthorizedException('Google OAuth failed');
    }
    return user;
  }
}
