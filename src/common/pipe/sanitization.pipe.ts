import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';


@Injectable()
export class SanitizationPipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {

        if (Buffer.isBuffer(value)) {
            return value;
        }
        if (typeof value === 'object' && value !== null) {
            return this.sanitizeObject(value);
        }
        if (typeof value === 'string') {
            return sanitizeHtml(value);
        }
        return value;
    }

    private sanitizeObject(obj: any): any {
        if (Buffer.isBuffer(obj)) {
            return obj;
        }

        const cleanObj = {};
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                cleanObj[key] = sanitizeHtml(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                cleanObj[key] = this.sanitizeObject(obj[key]);
            } else {
                cleanObj[key] = obj[key];
            }
        }
        return cleanObj;
    }
}
