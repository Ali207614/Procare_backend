export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface PaginationResult<T> extends PaginationMeta {
  rows: T[];
}
