import {
  Controller,
  Get,
  Post,
  // Body,
  Res,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, Request, CookieOptions } from 'express';
import { AuthService, OAuthProfile } from './auth.service';
// import { RegisterDto } from './dto/register.dto';
// import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { YandexAuthGuard } from './guards/yandex-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private getCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 день
    };
  }

  // --- Email/password login & register temporarily disabled ---
  // @Post('login')
  // async login(
  //   @Body() dto: LoginDto,
  //   @Res({ passthrough: true }) res: Response,
  // ) {
  //   const { token, user } = await this.authService.login(dto);
  //   res.cookie('access_token', token, this.getCookieOptions());
  //   return user;
  // }

  // @Post('register')
  // register(@Body() dto: RegisterDto) {
  //   return this.authService.register(dto);
  // }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: unknown }) {
    return req.user;
  }

  // --- Google OAuth ---

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  google() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: Request & { user: OAuthProfile },
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173/oberon/',
    );
    try {
      this.logger.log(`Google OAuth profile: ${JSON.stringify(req.user)}`);
      const { token } = await this.authService.oauthLogin(req.user);
      res.cookie('access_token', token, this.getCookieOptions());
      res.redirect(frontendUrl);
    } catch (err) {
      this.logger.error(`Google OAuth failed: ${err.message}`, err.stack);
      if (!res.headersSent) {
        res.redirect(`${frontendUrl}?auth_error=1`);
      }
    }
  }

  // --- Yandex OAuth ---

  @Get('yandex')
  @UseGuards(YandexAuthGuard)
  yandex() {
    // Guard redirects to Yandex
  }

  @Get('yandex/callback')
  @UseGuards(YandexAuthGuard)
  async yandexCallback(
    @Req() req: Request & { user: OAuthProfile },
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173/oberon/',
    );
    try {
      this.logger.log(`Yandex OAuth profile: ${JSON.stringify(req.user)}`);
      const { token } = await this.authService.oauthLogin(req.user);
      res.cookie('access_token', token, this.getCookieOptions());
      res.redirect(frontendUrl);
    } catch (err) {
      this.logger.error(`Yandex OAuth failed: ${err.message}`, err.stack);
      if (!res.headersSent) {
        res.redirect(`${frontendUrl}?auth_error=1`);
      }
    }
  }
}
