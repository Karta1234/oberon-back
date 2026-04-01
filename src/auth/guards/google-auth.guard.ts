import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private config: ConfigService) {
    super();
  }

  handleRequest<T>(
    err: Error | null,
    user: T,
    _info: unknown,
    context: ExecutionContext,
  ): T {
    if (err || !user) {
      const frontendUrl = this.config.get<string>(
        'FRONTEND_URL',
        'http://localhost:5173/oberon/',
      );
      const res = context.switchToHttp().getResponse<Response>();
      res.redirect(`${frontendUrl}login?error=oauth_failed`);
      return undefined as T;
    }
    return user;
  }
}
