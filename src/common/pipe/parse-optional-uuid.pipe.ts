import { Injectable } from '@nestjs/common';
import { PipeTransform, BadRequestException } from '@nestjs/common';
import { validate as isUUID } from 'uuid';

@Injectable()
export class ParseOptionalUUIDPipe implements PipeTransform {
  transform(value: string | undefined): string | undefined {
    if (!value || value.trim() === '') {
      return undefined;
    }

    if (!isUUID(value)) {
      throw new BadRequestException({
        message: 'Invalid UUID format',
        location: 'param_id',
      });
    }

    return value;
  }
}
