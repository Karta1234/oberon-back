import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateSettingDto {
  @IsString({ message: 'Значение должно быть строкой' })
  @IsNotEmpty({ message: 'Значение не может быть пустым' })
  value: string;
}
