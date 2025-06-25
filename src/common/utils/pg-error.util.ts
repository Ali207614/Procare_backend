import { DatabaseError } from 'pg';
import { HttpStatus } from '@nestjs/common';

interface ParsedPgError {
  status: number;
  message: string;
  errorType: string;
  location: string | null;
}

export function parsePgError(error: DatabaseError): ParsedPgError {
  switch (error.code) {
    case '23505': {
      const fieldMatch = error.detail?.match(/\((.*?)\)/);
      const field = fieldMatch ? fieldMatch[1] : 'unknown';
      return {
        status: HttpStatus.CONFLICT,
        message: `Duplicate value for field '${field}'`,
        errorType: 'ConflictError',
        location: field,
      };
    }

    case '23503':
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid reference to another table.',
        errorType: 'ForeignKeyViolation',
        location: null,
      };

    case '23502':
      return {
        status: HttpStatus.BAD_REQUEST,
        message: error.message,
        errorType: 'NotNullViolation',
        location: null,
      };

    default:
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message,
        errorType: 'DatabaseError',
        location: null,
      };
  }
}
