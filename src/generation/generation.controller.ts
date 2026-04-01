import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { GenerationQueryDto } from './dto/generation-query.dto';
import { GenerationService } from './generation.service';

@Controller('generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: CreateGenerationDto,
  ) {
    return this.generationService.create(req.user.id, dto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @Req() req: Request & { user: { id: string } },
    @Query() query: GenerationQueryDto,
  ) {
    return this.generationService.getHistory(req.user.id, query.page ?? 1, query.limit ?? 20);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findById(
    @Req() req: Request & { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.generationService.findById(id, req.user.id);
  }
}
