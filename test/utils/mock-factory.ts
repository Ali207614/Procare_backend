import { createMock } from 'jest-mock-extended';
import { ExecutionContext } from '@nestjs/common';

/**
 * Factory class for creating consistent mocks across tests
 * Follows the Factory pattern for standardized mock creation
 */
export class MockFactory {
  /**
   * Create a mock Knex database connection
   */
  static createMockKnex() {
    return {
      // Query builder methods
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNotIn: jest.fn().mockReturnThis(),
      whereBetween: jest.fn().mockReturnThis(),
      whereILike: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      rightJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      fullOuterJoin: jest.fn().mockReturnThis(),

      // Execution methods
      first: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      del: jest.fn(),
      count: jest.fn(),
      sum: jest.fn(),
      avg: jest.fn(),
      min: jest.fn(),
      max: jest.fn(),

      // Advanced methods
      raw: jest.fn(),
      transaction: jest.fn(),
      distinct: jest.fn().mockReturnThis(),
      union: jest.fn().mockReturnThis(),
      unionAll: jest.fn().mockReturnThis(),

      // Schema methods
      schema: {
        createTable: jest.fn(),
        dropTable: jest.fn(),
        alterTable: jest.fn(),
        hasTable: jest.fn(),
        hasColumn: jest.fn(),
      },

      // Utility methods
      destroy: jest.fn(),
      client: {
        config: {
          client: 'pg',
          connection: {},
        },
      },
    };
  }

  /**
   * Create a mock Redis client
   */
  static createMockRedis() {
    return {
      // String operations
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),

      // Key operations
      keys: jest.fn(),
      scan: jest.fn(),
      type: jest.fn(),

      // Hash operations
      hget: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      hexists: jest.fn(),
      hkeys: jest.fn(),
      hvals: jest.fn(),

      // List operations
      lpush: jest.fn(),
      rpush: jest.fn(),
      lpop: jest.fn(),
      rpop: jest.fn(),
      lrange: jest.fn(),
      llen: jest.fn(),

      // Set operations
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      scard: jest.fn(),
      sismember: jest.fn(),

      // Sorted set operations
      zadd: jest.fn(),
      zrem: jest.fn(),
      zrange: jest.fn(),
      zcard: jest.fn(),
      zscore: jest.fn(),

      // Pub/Sub operations
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),

      // Connection operations
      connect: jest.fn(),
      disconnect: jest.fn(),
      quit: jest.fn(),
      ping: jest.fn(),

      // Database operations
      select: jest.fn(),
      flushdb: jest.fn(),
      flushall: jest.fn(),

      // Transaction operations
      multi: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      discard: jest.fn(),
      watch: jest.fn(),
      unwatch: jest.fn(),
    };
  }

  /**
   * Create a mock JWT service
   */
  static createMockJwtService() {
    return {
      sign: jest.fn().mockReturnValue('mock.jwt.token'),
      verify: jest.fn().mockReturnValue({ id: 'user-123', role: 'admin' }),
      decode: jest.fn().mockReturnValue({ id: 'user-123', role: 'admin' }),
      signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
      verifyAsync: jest.fn().mockResolvedValue({ id: 'user-123', role: 'admin' }),
    };
  }

  /**
   * Create a mock Passport service
   */
  static createMockPassportService() {
    return {
      authenticate: jest.fn(),
      authorize: jest.fn(),
      initialize: jest.fn(),
      session: jest.fn(),
      use: jest.fn(),
    };
  }

  /**
   * Create a mock Telegram service
   */
  static createMockTelegramService() {
    return {
      sendMessage: jest.fn().mockResolvedValue({
        success: true,
        message_id: 123,
        chat_id: 'chat-123',
      }),
      sendPhoto: jest.fn().mockResolvedValue({
        success: true,
        message_id: 124,
      }),
      sendDocument: jest.fn().mockResolvedValue({
        success: true,
        message_id: 125,
      }),
      editMessage: jest.fn().mockResolvedValue({ success: true }),
      deleteMessage: jest.fn().mockResolvedValue({ success: true }),
      getUpdates: jest.fn().mockResolvedValue([]),
      setWebhook: jest.fn().mockResolvedValue({ success: true }),
      deleteWebhook: jest.fn().mockResolvedValue({ success: true }),
    };
  }

  /**
   * Create a mock Email service
   */
  static createMockEmailService() {
    return {
      sendEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'email-message-123',
        status: 'sent',
      }),
      sendBulkEmail: jest.fn().mockResolvedValue({
        success: true,
        sentCount: 10,
        failedCount: 0,
      }),
      validateEmail: jest.fn().mockReturnValue(true),
      getEmailTemplate: jest.fn().mockReturnValue({
        subject: 'Test Subject',
        body: 'Test Body',
      }),
      renderTemplate: jest.fn().mockReturnValue('Rendered Email Content'),
    };
  }

  /**
   * Create a mock SMS service
   */
  static createMockSmsService() {
    return {
      sendSms: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'sms-message-123',
        status: 'sent',
      }),
      sendBulkSms: jest.fn().mockResolvedValue({
        success: true,
        sentCount: 10,
        failedCount: 0,
      }),
      validatePhoneNumber: jest.fn().mockReturnValue(true),
      getDeliveryStatus: jest.fn().mockResolvedValue({
        status: 'delivered',
        deliveredAt: new Date(),
      }),
    };
  }

  /**
   * Create a mock Queue (Bull)
   */
  static createMockQueue() {
    return {
      add: jest.fn().mockResolvedValue({
        id: 'job-123',
        data: {},
        opts: {},
      }),
      process: jest.fn(),
      getJob: jest.fn().mockResolvedValue({
        id: 'job-123',
        progress: jest.fn(),
        remove: jest.fn(),
        retry: jest.fn(),
      }),
      getJobs: jest.fn().mockResolvedValue([]),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      }),
      clean: jest.fn().mockResolvedValue([]),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      empty: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
  }

  /**
   * Create a mock BullMQ Queue
   */
  static createMockBullMQQueue() {
    return {
      add: jest.fn().mockResolvedValue({
        id: 'job-123',
        name: 'test-job',
        data: {},
        opts: {},
      }),
      addBulk: jest.fn().mockResolvedValue([]),
      getJob: jest.fn().mockResolvedValue({
        id: 'job-123',
        updateProgress: jest.fn(),
        remove: jest.fn(),
        retry: jest.fn(),
      }),
      getJobs: jest.fn().mockResolvedValue([]),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      }),
      clean: jest.fn().mockResolvedValue(0),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      drain: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
  }

  /**
   * Create a mock guard
   */
  static createMockGuard() {
    return {
      canActivate: jest.fn().mockReturnValue(true),
    };
  }

  /**
   * Create a mock pipe
   */
  static createMockPipe() {
    return {
      transform: jest.fn().mockImplementation((value) => value),
    };
  }

  /**
   * Create a mock interceptor
   */
  static createMockInterceptor() {
    return {
      intercept: jest.fn().mockImplementation((context, next) => next.handle()),
    };
  }

  /**
   * Create a mock service based on service class
   */
  static createMockService(ServiceClass: any) {
    const mockService = createMock<typeof ServiceClass.prototype>();

    // Add common service methods if they don't exist
    const commonMethods = [
      'findAll',
      'findOne',
      'create',
      'update',
      'remove',
      'count',
      'exists',
      'validate',
    ];

    commonMethods.forEach((method) => {
      if (!mockService[method]) {
        mockService[method] = jest.fn();
      }
    });

    return mockService;
  }

  /**
   * Create a mock execution context for guards/interceptors
   */
  static createMockExecutionContext(): ExecutionContext {
    const mockRequest = {
      headers: {},
      user: null,
      admin: null,
      params: {},
      query: {},
      body: {},
      method: 'GET',
      url: '/test',
    };

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
    };

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getArgs: jest.fn().mockReturnValue([mockRequest, mockResponse]),
      getArgByIndex: jest
        .fn()
        .mockImplementation((index) => (index === 0 ? mockRequest : mockResponse)),
      getType: jest.fn().mockReturnValue('http'),
      getClass: jest.fn(),
      getHandler: jest.fn(),
    } as ExecutionContext;
  }

  /**
   * Create mock file upload
   */
  static createMockFile(options: Partial<Express.Multer.File> = {}): Express.Multer.File {
    return {
      fieldname: 'file',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('fake-image-data'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
      ...options,
    };
  }

  /**
   * Create mock HTTP request
   */
  static createMockRequest(options: any = {}) {
    return {
      method: 'GET',
      url: '/test',
      headers: {},
      params: {},
      query: {},
      body: {},
      user: null,
      admin: null,
      ...options,
    };
  }

  /**
   * Create mock HTTP response
   */
  static createMockResponse() {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
    return res;
  }

  /**
   * Create mock logger
   */
  static createMockLogger() {
    return {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };
  }

  /**
   * Create mock configuration service
   */
  static createMockConfigService() {
    return {
      get: jest.fn().mockImplementation((key: string) => {
        const config = {
          DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
          REDIS_URL: 'redis://localhost:6379',
          JWT_SECRET: 'test-secret',
          NODE_ENV: 'test',
        };
        return config[key];
      }),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        const value = this.get(key);
        if (value === undefined) {
          throw new Error(`Configuration key "${key}" not found`);
        }
        return value;
      }),
    };
  }

  /**
   * Create mock cache manager
   */
  static createMockCacheManager() {
    return {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      reset: jest.fn(),
      wrap: jest.fn().mockImplementation(async (key, fn) => {
        return await fn();
      }),
    };
  }

  /**
   * Create mock event emitter
   */
  static createMockEventEmitter() {
    return {
      emit: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      listeners: jest.fn().mockReturnValue([]),
      listenerCount: jest.fn().mockReturnValue(0),
    };
  }

  /**
   * Reset all mocks in an object
   */
  static resetMocks(mockObject: any): void {
    Object.values(mockObject).forEach((value: any) => {
      if (jest.isMockFunction(value)) {
        value.mockReset();
      } else if (typeof value === 'object' && value !== null) {
        this.resetMocks(value);
      }
    });
  }

  /**
   * Clear all mocks in an object
   */
  static clearMocks(mockObject: any): void {
    Object.values(mockObject).forEach((value: any) => {
      if (jest.isMockFunction(value)) {
        value.mockClear();
      } else if (typeof value === 'object' && value !== null) {
        this.clearMocks(value);
      }
    });
  }
}

/**
 * Mock presets for common testing scenarios
 */
export class MockPresets {
  /**
   * Standard service test mocks
   */
  static forServiceTest() {
    return {
      knex: MockFactory.createMockKnex(),
      redis: MockFactory.createMockRedis(),
      logger: MockFactory.createMockLogger(),
    };
  }

  /**
   * Controller test mocks
   */
  static forControllerTest() {
    return {
      ...this.forServiceTest(),
      jwtGuard: MockFactory.createMockGuard(),
      permissionGuard: MockFactory.createMockGuard(),
    };
  }

  /**
   * Integration test mocks
   */
  static forIntegrationTest() {
    return {
      ...this.forServiceTest(),
      telegramService: MockFactory.createMockTelegramService(),
      emailService: MockFactory.createMockEmailService(),
      smsService: MockFactory.createMockSmsService(),
      queue: MockFactory.createMockQueue(),
    };
  }

  /**
   * E2E test mocks (minimal mocking)
   */
  static forE2ETest() {
    return {
      telegramService: MockFactory.createMockTelegramService(),
      emailService: MockFactory.createMockEmailService(),
      smsService: MockFactory.createMockSmsService(),
    };
  }
}
