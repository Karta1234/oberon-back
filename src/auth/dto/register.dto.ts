import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'email должен быть валидным' })
  email: string;

  @IsString({ message: 'пароль должен быть строкой' })
  @MinLength(6, { message: 'пароль минимум 6 символов' })
  password: string;

  @IsOptional()
  @IsString({ message: 'имя должно быть строкой' })
  name?: string;
}
