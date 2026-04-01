declare module 'passport-yandex' {
  import { Strategy as PassportStrategy } from 'passport';

  interface YandexStrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  }

  interface YandexProfile {
    id: string;
    displayName?: string;
    emails?: Array<{ value: string }>;
    name?: { familyName?: string; givenName?: string };
  }

  type VerifyCallback = (
    err: Error | null,
    user?: object,
    info?: object,
  ) => void;

  type VerifyFunction = (
    accessToken: string,
    refreshToken: string,
    profile: YandexProfile,
    done: VerifyCallback,
  ) => void;

  class Strategy extends PassportStrategy {
    constructor(options: YandexStrategyOptions, verify: VerifyFunction);
    name: string;
  }
}
