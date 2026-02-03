import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { validate as isUUID } from 'uuid';

@Injectable()
export class ParseUUIDPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value) {
      throw new BadRequestException({
        message: 'UUID is required',
        location: 'params_id',
      });
    }

    // Special case for status IDs that might use custom format
    if (this.isCustomStatusId(value)) {
      return value;
    }

    if (!isUUID(value)) {
      throw new BadRequestException({
        message: 'Invalid UUID format',
        location: 'params_id',
      });
    }
    return value;
  }

  /**
   * Check if this is a custom status ID format
   * Allows formats like: 50000000-0000-0000-0001-001000000000
   */
  private isCustomStatusId(value: string): boolean {
    // Check if it's a UUID-like format (8-4-4-4-12 characters)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(value);
  }
}
