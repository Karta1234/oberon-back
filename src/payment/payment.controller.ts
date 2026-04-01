import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  createPayment(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentService.createPayment(req.user.id, dto);
  }

  @Post('webhook')
  async handleWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ) {
    await this.paymentService.handleWebhook(body, headers);
    return { ok: true };
  }
}
