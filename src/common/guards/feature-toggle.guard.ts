import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureService } from 'src/feature/feature.service';
import { FEATURE_TOGGLE_KEY } from '../decorators/feature-toggle.decorator';

@Injectable()
export class FeatureToggleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureService: FeatureService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.get<string>(FEATURE_TOGGLE_KEY, context.getHandler());

    if (!featureKey) return true;

    const isActive = await this.featureService.isFeatureActive(featureKey);

    if (!isActive) {
      throw new ForbiddenException({
        message: `🚫 This feature is currently disabled.`,
        location: featureKey,
      });
    }

    return true;
  }
}
