import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingService } from '../setting/setting.service';
import { PolzaApiService } from './polza-api.service';
import { CreateGenerationDto } from './dto/create-generation.dto';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);
  private readonly markupPercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly polzaApiService: PolzaApiService,
    private readonly storageService: StorageService,
    private readonly walletService: WalletService,
    private readonly config: ConfigService,
    private readonly settingService: SettingService,
  ) {
    this.markupPercent = this.config.get<number>(
      'GENERATION_MARKUP_PERCENT',
      30,
    );
  }

  async create(accountId: string, dto: CreateGenerationDto) {
    const hasBalance = await this.walletService.hasBalance(accountId, 1);
    if (!hasBalance) {
      throw new BadRequestException('Недостаточно средств для генерации');
    }

    const generation = await this.prisma.generation.create({
      data: {
        accountId,
        prompt: dto.prompt,
        style: dto.style,
        polzaModel: 'google/gemini-3.1-flash-image-preview',
        status: 'uploading',
      },
    });

    this.processGeneration(generation.id, accountId, dto).catch(
      (err: unknown) => {
        this.logger.error(
          `processGeneration failed for ${generation.id}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      },
    );

    return { id: generation.id, status: generation.status };
  }

  private async processGeneration(
    generationId: string,
    accountId: string,
    dto: CreateGenerationDto,
  ): Promise<void> {
    try {
      // Upload room image
      let roomImageBuffer: Buffer;
      if (dto.roomImage.type === 'base64') {
        roomImageBuffer = Buffer.from(dto.roomImage.data, 'base64');
      } else {
        roomImageBuffer = await this.polzaApiService.downloadImage(
          dto.roomImage.data,
        );
      }
      const roomImageKey = `${generationId}/room.jpg`;
      await this.storageService.upload(
        'room-images',
        roomImageKey,
        roomImageBuffer,
        'image/jpeg',
      );
      await this.prisma.generation.update({
        where: { id: generationId },
        data: { roomImageKey },
      });

      // Upload furniture images
      const furnitureImageKeys: string[] = [];
      const furnitureBuffers: Buffer[] = [];
      for (let i = 0; i < dto.furnitureImages.length; i++) {
        const img = dto.furnitureImages[i];
        let buffer: Buffer;
        if (img.type === 'base64') {
          buffer = Buffer.from(img.data, 'base64');
        } else {
          buffer = await this.polzaApiService.downloadImage(img.data);
        }
        const key = `${generationId}/furniture-${i}.jpg`;
        await this.storageService.upload(
          'furniture-images',
          key,
          buffer,
          'image/jpeg',
        );
        furnitureImageKeys.push(key);
        furnitureBuffers.push(buffer);
      }
      await this.prisma.generation.update({
        where: { id: generationId },
        data: { furnitureImageKeys },
      });

      // Build Polza API request using base64 images directly
      const images: Array<{ type: 'base64'; data: string }> = [
        { type: 'base64', data: roomImageBuffer.toString('base64') },
        ...furnitureBuffers.map((buf) => ({
          type: 'base64' as const,
          data: buf.toString('base64'),
        })),
      ];

      const mainPrompt = await this.settingService.get('main_prompt');
      const userPrompt =
        dto.prompt + (dto.style ? `. Стиль: ${dto.style}` : '');
      const promptText = mainPrompt
        ? mainPrompt + '\n' + userPrompt
        : userPrompt;
      const polzaRequest = {
        model: 'google/gemini-3.1-flash-image-preview',
        input: {
          prompt: promptText,
          images,
          ...(dto.aspectRatio !== undefined && {
            aspect_ratio: dto.aspectRatio,
          }),
          ...(dto.imageResolution !== undefined && {
            image_resolution: dto.imageResolution,
          }),
          ...(dto.quality !== undefined && { quality: dto.quality }),
          ...(dto.strength !== undefined && { strength: dto.strength }),
        },
      };

      // Update status to pending
      await this.prisma.generation.update({
        where: { id: generationId },
        data: { status: 'pending' },
      });

      // Create generation in Polza API
      const polzaResponse =
        await this.polzaApiService.createGeneration(polzaRequest);
      const polzaId = polzaResponse.id;

      await this.prisma.generation.update({
        where: { id: generationId },
        data: { polzaGenerationId: polzaId, status: 'processing' },
      });

      // Poll for result
      for (let attempt = 0; attempt < 150; attempt++) {
        await new Promise((r) => setTimeout(r, 4000));
        const result =
          await this.polzaApiService.pollGeneration(polzaId);

        if (result.status === 'completed') {
          const imageBuffer = await this.polzaApiService.downloadImage(
            result.data!.url,
          );
          const resultKey = `${generationId}/result.jpg`;
          await this.storageService.upload(
            'generated-results',
            resultKey,
            imageBuffer,
            'image/jpeg',
          );

          const costRub = result.usage?.cost_rub ?? 0;
          const markup = this.markupPercent;
          const totalCostRub = +(costRub * (1 + markup / 100)).toFixed(2);

          try {
            await this.walletService.charge(
              accountId,
              totalCostRub,
              `Генерация ${generationId}`,
              generationId,
            );
          } catch {
            await this.prisma.generation.update({
              where: { id: generationId },
              data: { status: 'failed', errorMessage: 'Недостаточно средств' },
            });
            return;
          }

          await this.prisma.generation.update({
            where: { id: generationId },
            data: {
              status: 'completed',
              resultImageKey: resultKey,
              costRub,
              totalCostRub,
              completedAt: new Date(),
            },
          });
          return;
        }

        if (result.status === 'failed') {
          await this.prisma.generation.update({
            where: { id: generationId },
            data: {
              status: 'failed',
              errorMessage: result.error?.message ?? 'Неизвестная ошибка',
            },
          });
          return;
        }
      }

      // Timeout
      await this.prisma.generation.update({
        where: { id: generationId },
        data: {
          status: 'failed',
          errorMessage: 'Превышено время ожидания генерации',
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      this.logger.error(`Generation ${generationId} failed: ${message}`);
      await this.prisma.generation.update({
        where: { id: generationId },
        data: { status: 'failed', errorMessage: message },
      });
    }
  }

  async findById(id: string, accountId: string) {
    const generation = await this.prisma.generation.findFirst({
      where: { id, accountId },
    });

    if (!generation) {
      throw new NotFoundException('Генерация не найдена');
    }

    let resultUrl: string | undefined;
    if (generation.status === 'completed' && generation.resultImageKey) {
      resultUrl = await this.storageService.getPresignedUrl(
        'generated-results',
        generation.resultImageKey,
      );
    }

    return { ...generation, resultUrl };
  }

  async getHistory(accountId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.generation.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.generation.count({ where: { accountId } }),
    ]);

    const itemsWithUrls = await Promise.all(
      items.map(async (item) => {
        let resultUrl: string | undefined;
        if (item.status === 'completed' && item.resultImageKey) {
          resultUrl = await this.storageService.getPresignedUrl(
            'generated-results',
            item.resultImageKey,
          );
        }
        return { ...item, resultUrl };
      }),
    );

    return { items: itemsWithUrls, total, page, limit };
  }
}
