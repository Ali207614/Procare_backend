import { RequestAuditContextMiddleware } from '../../src/common/middleware/request-audit-context.middleware';
import { getRequestAuditContext, runWithRequestAuditContext } from '../../src/common/utils/request-audit-context.util';

describe('request audit context', () => {
  it('preserves audit metadata across async work', async () => {
    const context = {
      requestId: 'req-123',
      correlationId: 'corr-456',
      httpMethod: 'PATCH',
      httpPath: '/api/v1/repair-orders/abc',
      ipAddress: '203.0.113.10',
      userAgent: 'PostmanRuntime/7.43.0',
    };

    await runWithRequestAuditContext(context, async () => {
      await Promise.resolve();

      expect(getRequestAuditContext()).toEqual(context);
    });
  });

  it('captures request metadata inside the middleware context', () => {
    const middleware = new RequestAuditContextMiddleware();
    let capturedContext: ReturnType<typeof getRequestAuditContext>;

    middleware.use(
      {
        headers: {
          'x-request-id': 'req-789',
          'x-correlation-id': 'corr-999',
          'user-agent': 'PostmanRuntime/7.43.0',
        },
        method: 'PATCH',
        originalUrl: '/api/v1/repair-orders/123',
        ip: '198.51.100.7',
      } as any,
      {} as any,
      () => {
        capturedContext = getRequestAuditContext();
      },
    );

    expect(capturedContext).toEqual({
      requestId: 'req-789',
      correlationId: 'corr-999',
      httpMethod: 'PATCH',
      httpPath: '/api/v1/repair-orders/123',
      ipAddress: '198.51.100.7',
      userAgent: 'PostmanRuntime/7.43.0',
    });
  });
});
