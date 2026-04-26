export interface RequestAuditContext {
  requestId?: string | null;
  correlationId?: string | null;
  httpMethod?: string | null;
  httpPath?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}
