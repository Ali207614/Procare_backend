// src/common/decorators/ban-type.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const BanType = (type: string) => SetMetadata('banType', type);
