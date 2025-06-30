export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort_by?: 'sort' | 'priority' | 'created_at';
  sort_order?: 'asc' | 'desc';
}
