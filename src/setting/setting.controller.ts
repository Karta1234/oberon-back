import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'generated/prisma/client';
import { SettingService } from './setting.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @Get('main-prompt')
  async getMainPrompt() {
    const value = await this.settingService.get('main_prompt');
    return { value: value ?? '' };
  }

  @Put('main-prompt')
  async updateMainPrompt(@Body() dto: UpdateSettingDto) {
    await this.settingService.set('main_prompt', dto.value);
    return { value: dto.value };
  }
}
