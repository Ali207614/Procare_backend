import { Controller, Get, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { FeatureService } from './feature.service';

interface FeaturesMap {
  [key: string]: boolean;
}

@ApiTags('Features')
@Controller('features')
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @ApiOperation({ summary: 'Get bookings by specific date' })
  @Get()
  async getAll(): Promise<FeaturesMap> {
    return this.featureService.getAllFeatures();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get by key' })
  async checkFeature(@Param('key') key: string): Promise<{ key: string; is_active: boolean }> {
    const isActive: boolean = await this.featureService.isFeatureActive(key);
    return { key, is_active: isActive };
  }

  @Patch(':key')
  @UseGuards(JwtAdminAuthGuard)
  @ApiOperation({ summary: 'Update features' })
  async update(
    @Param('key') key: string,
    @Body() body: { is_active: boolean },
  ): Promise<{ message: string }> {
    return this.featureService.updateFeature(key, body.is_active);
  }
}
