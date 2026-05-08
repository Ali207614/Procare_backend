import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestAuditContext } from '../types/request-audit-context.type';

const requestAuditContextStorage = new AsyncLocalStorage<RequestAuditContext>();

export function runWithRequestAuditContext<T>(context: RequestAuditContext, callback: () => T): T {
  return requestAuditContextStorage.run(context, callback);
}

export function getRequestAuditContext(): RequestAuditContext | undefined {
  return requestAuditContextStorage.getStore();
}
