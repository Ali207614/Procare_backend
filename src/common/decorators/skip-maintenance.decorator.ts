import { SetMetadata } from '@nestjs/common';

export const SKIP_MAINTENANCE_KEY = 'skipMaintenance';
export const SkipMaintenance = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(SKIP_MAINTENANCE_KEY, true);
