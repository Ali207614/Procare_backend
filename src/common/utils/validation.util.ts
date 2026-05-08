import { ValidationError } from 'class-validator';

function capitalizeFirstLetter(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function extractError(errors: ValidationError[]): {
  message: string;
  location: string | null;
} {
  for (const err of errors) {
    if (!err.constraints && !err.children?.length && err.property && err.value !== undefined) {
      return {
        message: capitalizeFirstLetter(`Property '${err.property}' is not allowed`),
        location: err.property,
      };
    }

    if (err.constraints) {
      const key = Object.keys(err.constraints)[0] as keyof typeof err.constraints;
      return {
        message: capitalizeFirstLetter(err.constraints[key]),
        location: err.contexts?.[key]?.location ?? err.property ?? null,
      };
    }

    if (err.children?.length) {
      const nested = extractError(err.children);
      if (nested) return nested;
    }
  }

  return { message: 'Unexpected error', location: null };
}
