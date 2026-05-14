import { NextFunction, Request, Response } from 'express';
import { AuthRateLimiterMiddleware } from 'src/common/middleware/auth-rate-limiter.middleware';
import { LoggerService } from 'src/common/logger/logger.service';

describe('AuthRateLimiterMiddleware', () => {
  const createRequest = (ip = '203.0.113.10'): Request =>
    ({
      method: 'POST',
      originalUrl: '/auth/admin/login',
      ip,
      ips: [],
      socket: {
        remoteAddress: ip,
      },
    }) as unknown as Request;

  const createResponse = (onJson?: () => void): Response => {
    const response: Partial<Response> = {};
    response.status = jest.fn().mockReturnValue(response) as unknown as Response['status'];
    response.json = jest.fn().mockImplementation(() => {
      onJson?.();
      return response;
    }) as unknown as Response['json'];
    response.setHeader = jest.fn() as unknown as Response['setHeader'];
    response.getHeader = jest.fn() as unknown as Response['getHeader'];

    return response as unknown as Response;
  };

  const createLogger = (): jest.Mocked<Pick<LoggerService, 'warn'>> => ({
    warn: jest.fn(),
  });

  const runRequest = (
    middleware: AuthRateLimiterMiddleware,
    response = createResponse(),
    next: NextFunction = jest.fn(),
  ): Promise<NextFunction> =>
    new Promise((resolve) => {
      const settle = (): void => {
        resolve(next);
      };
      const wrappedNext: NextFunction = (...args) => {
        next(...args);
        settle();
      };

      middleware.use(createRequest(), response, wrappedNext);
      setTimeout(settle, 10);
    });

  it('allows the configured number of auth requests from one IP', async () => {
    const middleware = new AuthRateLimiterMiddleware(
      null,
      createLogger() as unknown as LoggerService,
    );
    const response = createResponse();
    const next: NextFunction = jest.fn();

    for (let i = 0; i < 50; i++) {
      await runRequest(middleware, response, next);
    }

    expect(next).toHaveBeenCalledTimes(50);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  it('returns the auth rate limit response when one IP exceeds the limit', async () => {
    const logger = createLogger();
    const middleware = new AuthRateLimiterMiddleware(null, logger as unknown as LoggerService);
    const response = createResponse();
    const next: NextFunction = jest.fn();

    for (let i = 0; i < 51; i++) {
      await runRequest(middleware, response, next);
    }

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        message: 'Too many authentication requests from this IP. Please try again after 15 minutes.',
        error: 'TooManyRequests',
        location: 'auth_rate_limit',
        path: '/auth/admin/login',
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('AUTH RATE LIMIT EXCEEDED'),
    );
  });
});
