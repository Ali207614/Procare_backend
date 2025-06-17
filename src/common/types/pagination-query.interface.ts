export interface PaginationQuery {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: 'sort' | 'priority' | 'created_at';
    sortOrder?: 'asc' | 'desc';
}
