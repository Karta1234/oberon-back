import { Type } from 'class-transformer';
import {
  IsString,
  MinLength,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsIn,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class ImageInputDto {
  @IsIn(['url', 'base64'], { message: 'type должен быть url или base64' })
  type: 'url' | 'base64';

  @IsString({ message: 'data должен быть строкой' })
  data: string;
}

export class CreateGenerationDto {
  @IsString({ message: 'prompt должен быть строкой' })
  @MinLength(10, { message: 'prompt минимум 10 символов' })
  prompt: string;

  @IsOptional()
  @IsString({ message: 'style должен быть строкой' })
  style?: string;

  @ValidateNested()
  @Type(() => ImageInputDto)
  roomImage: ImageInputDto;

  @IsArray({ message: 'furnitureImages должен быть массивом' })
  @ValidateNested({ each: true })
  @Type(() => ImageInputDto)
  @ArrayMinSize(1, { message: 'минимум 1 изображение мебели' })
  @ArrayMaxSize(5, { message: 'максимум 5 изображений мебели' })
  furnitureImages: ImageInputDto[];

  @IsOptional()
  @IsString({ message: 'model должен быть строкой' })
  model?: string;

  @IsOptional()
  @IsString()
  aspectRatio?: string;

  @IsOptional()
  @IsString()
  imageResolution?: string;

  @IsOptional()
  @IsString()
  quality?: string;

  @IsOptional()
  @IsNumber({}, { message: 'strength должен быть числом' })
  @Min(0)
  @Max(1)
  strength?: number;
}
