import { PipeTransform, Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (Buffer.isBuffer(value)) return value;

    if (typeof value === 'object' && value !== null) {
      return this.sanitizeObject(value as Record<string, unknown>);
    }

    if (typeof value === 'string') {
      return sanitizeHtml(value);
    }

    return value;
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    if (Buffer.isBuffer(obj)) {
      return obj;
    }

    const cleanObj: Record<string, unknown> = {};

    for (const key in obj) {
      const val = obj[key];

      if (typeof val === 'string') {
        cleanObj[key] = sanitizeHtml(val);
      } else if (Array.isArray(val)) {
        cleanObj[key] = val;
      } else if (typeof val === 'object' && val !== null) {
        cleanObj[key] = this.sanitizeObject(val as Record<string, unknown>);
      } else {
        cleanObj[key] = val;
      }
    }

    return cleanObj;
  }
}
