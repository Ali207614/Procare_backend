// src/common/decorators/feature-toggle.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const FEATURE_TOGGLE_KEY = 'featureToggle';
export const FeatureToggle = (featureKey: string): ReturnType<typeof SetMetadata> =>
  SetMetadata(FEATURE_TOGGLE_KEY, featureKey);
