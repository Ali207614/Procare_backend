import { Transform, TransformFnParams } from 'class-transformer';

/**
 * Har qanday query parametrni massivga aylantiradi.
 * - Agar array bo‘lsa, o‘zini qaytaradi
 * - Agar string bo‘lsa, massivga o‘rab qaytaradi
 * - Aks holda bo‘sh massiv qaytaradi
 */
export function ToArray() {
  return Transform(({ value }: TransformFnParams): string[] => {
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') return [value];
    return [];
  });
}
