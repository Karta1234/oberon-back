import { IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber({}, { message: 'amount должен быть числом' })
  @Min(1, { message: 'минимальная сумма пополнения — 1 руб.' })
  amount: number;

  @IsOptional()
  @IsString({ message: 'description должен быть строкой' })
  description?: string;
}
