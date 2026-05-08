export function extractDefinedFields<T extends Record<string, unknown>>(
  dto: T,
  allowedFields: (keyof T)[],
): Partial<T> {
  const result: Partial<T> = {};
  for (const field of allowedFields) {
    if (dto[field] !== undefined) {
      result[field] = dto[field];
    }
  }
  return result;
}
