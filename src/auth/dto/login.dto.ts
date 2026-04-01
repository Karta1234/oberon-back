import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'email должен быть валидным' })
  email: string;

  @IsString({ message: 'пароль должен быть строкой' })
  password: string;
}
