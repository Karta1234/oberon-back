import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-yandex';

@Injectable()
export class YandexStrategy extends PassportStrategy(Strategy, 'yandex') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('YANDEX_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('YANDEX_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('YANDEX_CALLBACK_URL'),
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      emails?: Array<{ value: string }>;
      displayName?: string;
    },
    done: (err: Error | null, user?: object) => void,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('Yandex account has no email'));
    }

    done(null, {
      provider: 'yandex',
      providerUserId: profile.id,
      email,
      name: profile.displayName || undefined,
    });
  }
}
