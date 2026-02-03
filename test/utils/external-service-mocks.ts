import { Injectable, Provider } from '@nestjs/common';
import { MockFactory } from './mock-factory';

/**
 * Comprehensive mocking strategies for external dependencies
 * Follows the Strategy pattern for different mocking approaches
 */

/**
 * Mock strategy interface
 */
interface MockStrategy {
  createMock(): any;
  configureMock(mock: any, scenario?: string): void;
  resetMock(mock: any): void;
}

/**
 * Database mock strategy
 */
export class DatabaseMockStrategy implements MockStrategy {
  createMock() {
    return MockFactory.createMockKnex();
  }

  configureMock(mock: any, scenario?: string): void {
    switch (scenario) {
      case 'success':
        this.configureSuccessScenario(mock);
        break;
      case 'error':
        this.configureErrorScenario(mock);
        break;
      case 'slow':
        this.configureSlowScenario(mock);
        break;
      default:
        this.configureDefaultScenario(mock);
    }
  }

  private configureSuccessScenario(mock: any): void {
    mock.first.mockResolvedValue({ id: 'test-id', name: 'Test Data' });
    mock.insert.mockResolvedValue(['inserted-id']);
    mock.update.mockResolvedValue(1);
    mock.del.mockResolvedValue(1);
    mock.count.mockResolvedValue([{ count: '10' }]);
    mock.transaction.mockImplementation((callback) => callback(mock));
  }

  private configureErrorScenario(mock: any): void {
    const error = new Error('Database connection failed');
    mock.first.mockRejectedValue(error);
    mock.insert.mockRejectedValue(error);
    mock.update.mockRejectedValue(error);
    mock.del.mockRejectedValue(error);
    mock.transaction.mockRejectedValue(error);
  }

  private configureSlowScenario(mock: any): void {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    mock.first.mockImplementation(async () => {
      await delay(2000);
      return { id: 'test-id', name: 'Slow Data' };
    });

    mock.insert.mockImplementation(async () => {
      await delay(1000);
      return ['slow-insert-id'];
    });
  }

  private configureDefaultScenario(mock: any): void {
    this.configureSuccessScenario(mock);
  }

  resetMock(mock: any): void {
    MockFactory.resetMocks(mock);
  }
}

/**
 * Redis mock strategy
 */
export class RedisMockStrategy implements MockStrategy {
  createMock() {
    return MockFactory.createMockRedis();
  }

  configureMock(mock: any, scenario?: string): void {
    switch (scenario) {
      case 'cache_hit':
        this.configureCacheHitScenario(mock);
        break;
      case 'cache_miss':
        this.configureCacheMissScenario(mock);
        break;
      case 'error':
        this.configureErrorScenario(mock);
        break;
      default:
        this.configureDefaultScenario(mock);
    }
  }

  private configureCacheHitScenario(mock: any): void {
    mock.get.mockResolvedValue(JSON.stringify({ cached: true, data: 'test' }));
    mock.set.mockResolvedValue('OK');
    mock.del.mockResolvedValue(1);
    mock.exists.mockResolvedValue(1);
  }

  private configureCacheMissScenario(mock: any): void {
    mock.get.mockResolvedValue(null);
    mock.set.mockResolvedValue('OK');
    mock.del.mockResolvedValue(0);
    mock.exists.mockResolvedValue(0);
  }

  private configureErrorScenario(mock: any): void {
    const error = new Error('Redis connection failed');
    mock.get.mockRejectedValue(error);
    mock.set.mockRejectedValue(error);
    mock.del.mockRejectedValue(error);
  }

  private configureDefaultScenario(mock: any): void {
    this.configureCacheMissScenario(mock);
  }

  resetMock(mock: any): void {
    MockFactory.resetMocks(mock);
  }
}

/**
 * SMS service mock strategy
 */
export class SmsServiceMockStrategy implements MockStrategy {
  createMock() {
    return MockFactory.createMockSmsService();
  }

  configureMock(mock: any, scenario?: string): void {
    switch (scenario) {
      case 'success':
        this.configureSuccessScenario(mock);
        break;
      case 'failure':
        this.configureFailureScenario(mock);
        break;
      case 'rate_limit':
        this.configureRateLimitScenario(mock);
        break;
      case 'invalid_number':
        this.configureInvalidNumberScenario(mock);
        break;
      default:
        this.configureSuccessScenario(mock);
    }
  }

  private configureSuccessScenario(mock: any): void {
    mock.sendSms.mockResolvedValue({
      success: true,
      messageId: 'sms-123',
      status: 'sent',
    });
    mock.validatePhoneNumber.mockReturnValue(true);
  }

  private configureFailureScenario(mock: any): void {
    mock.sendSms.mockRejectedValue(new Error('SMS delivery failed'));
    mock.validatePhoneNumber.mockReturnValue(true);
  }

  private configureRateLimitScenario(mock: any): void {
    mock.sendSms.mockRejectedValue(new Error('Rate limit exceeded'));
    mock.validatePhoneNumber.mockReturnValue(true);
  }

  private configureInvalidNumberScenario(mock: any): void {
    mock.sendSms.mockRejectedValue(new Error('Invalid phone number'));
    mock.validatePhoneNumber.mockReturnValue(false);
  }

  resetMock(mock: any): void {
    MockFactory.resetMocks(mock);
  }
}

/**
 * Email service mock strategy
 */
export class EmailServiceMockStrategy implements MockStrategy {
  createMock() {
    return MockFactory.createMockEmailService();
  }

  configureMock(mock: any, scenario?: string): void {
    switch (scenario) {
      case 'success':
        this.configureSuccessScenario(mock);
        break;
      case 'bounce':
        this.configureBounceScenario(mock);
        break;
      case 'spam':
        this.configureSpamScenario(mock);
        break;
      case 'quota_exceeded':
        this.configureQuotaScenario(mock);
        break;
      default:
        this.configureSuccessScenario(mock);
    }
  }

  private configureSuccessScenario(mock: any): void {
    mock.sendEmail.mockResolvedValue({
      success: true,
      messageId: 'email-123',
      status: 'sent',
    });
    mock.validateEmail.mockReturnValue(true);
  }

  private configureBounceScenario(mock: any): void {
    mock.sendEmail.mockResolvedValue({
      success: false,
      messageId: 'email-bounce-123',
      status: 'bounced',
      error: 'Email address not found',
    });
    mock.validateEmail.mockReturnValue(true);
  }

  private configureSpamScenario(mock: any): void {
    mock.sendEmail.mockResolvedValue({
      success: false,
      messageId: 'email-spam-123',
      status: 'rejected',
      error: 'Message rejected as spam',
    });
  }

  private configureQuotaScenario(mock: any): void {
    mock.sendEmail.mockRejectedValue(new Error('Daily sending quota exceeded'));
  }

  resetMock(mock: any): void {
    MockFactory.resetMocks(mock);
  }
}

/**
 * Telegram service mock strategy
 */
export class TelegramServiceMockStrategy implements MockStrategy {
  createMock() {
    return MockFactory.createMockTelegramService();
  }

  configureMock(mock: any, scenario?: string): void {
    switch (scenario) {
      case 'success':
        this.configureSuccessScenario(mock);
        break;
      case 'blocked_user':
        this.configureBlockedUserScenario(mock);
        break;
      case 'invalid_chat':
        this.configureInvalidChatScenario(mock);
        break;
      case 'api_error':
        this.configureApiErrorScenario(mock);
        break;
      default:
        this.configureSuccessScenario(mock);
    }
  }

  private configureSuccessScenario(mock: any): void {
    mock.sendMessage.mockResolvedValue({
      success: true,
      message_id: 123,
      chat_id: 'chat-123',
    });
  }

  private configureBlockedUserScenario(mock: any): void {
    mock.sendMessage.mockRejectedValue(new Error('Forbidden: bot was blocked by the user'));
  }

  private configureInvalidChatScenario(mock: any): void {
    mock.sendMessage.mockRejectedValue(new Error('Bad Request: chat not found'));
  }

  private configureApiErrorScenario(mock: any): void {
    mock.sendMessage.mockRejectedValue(new Error('Telegram API temporarily unavailable'));
  }

  resetMock(mock: any): void {
    MockFactory.resetMocks(mock);
  }
}

/**
 * Queue service mock strategy
 */
export class QueueMockStrategy implements MockStrategy {
  createMock() {
    return MockFactory.createMockBullMQQueue();
  }

  configureMock(mock: any, scenario?: string): void {
    switch (scenario) {
      case 'success':
        this.configureSuccessScenario(mock);
        break;
      case 'queue_full':
        this.configureQueueFullScenario(mock);
        break;
      case 'worker_error':
        this.configureWorkerErrorScenario(mock);
        break;
      case 'stalled_jobs':
        this.configureStalledJobsScenario(mock);
        break;
      default:
        this.configureSuccessScenario(mock);
    }
  }

  private configureSuccessScenario(mock: any): void {
    mock.add.mockResolvedValue({
      id: 'job-123',
      name: 'test-job',
      data: {},
      opts: {},
    });
    mock.getJobCounts.mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 10,
      failed: 0,
    });
  }

  private configureQueueFullScenario(mock: any): void {
    mock.add.mockRejectedValue(new Error('Queue is full'));
    mock.getJobCounts.mockResolvedValue({
      waiting: 1000,
      active: 50,
      completed: 0,
      failed: 0,
    });
  }

  private configureWorkerErrorScenario(mock: any): void {
    mock.add.mockResolvedValue({ id: 'job-123' });
    mock.getJobCounts.mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 5,
      failed: 15,
    });
  }

  private configureStalledJobsScenario(mock: any): void {
    mock.getJobCounts.mockResolvedValue({
      waiting: 0,
      active: 25, // High number of active jobs
      completed: 0,
      failed: 0,
    });
  }

  resetMock(mock: any): void {
    MockFactory.resetMocks(mock);
  }
}

/**
 * Authentication mock strategy
 */
export class AuthMockStrategy implements MockStrategy {
  createMock() {
    return MockFactory.createMockJwtService();
  }

  configureMock(mock: any, scenario?: string): void {
    switch (scenario) {
      case 'valid_token':
        this.configureValidTokenScenario(mock);
        break;
      case 'expired_token':
        this.configureExpiredTokenScenario(mock);
        break;
      case 'invalid_token':
        this.configureInvalidTokenScenario(mock);
        break;
      case 'insufficient_permissions':
        this.configureInsufficientPermissionsScenario(mock);
        break;
      default:
        this.configureValidTokenScenario(mock);
    }
  }

  private configureValidTokenScenario(mock: any): void {
    mock.sign.mockReturnValue('valid.jwt.token');
    mock.verify.mockReturnValue({
      id: 'admin-123',
      role: 'admin',
      permissions: ['repair_orders.read', 'repair_orders.create'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
  }

  private configureExpiredTokenScenario(mock: any): void {
    mock.verify.mockImplementation(() => {
      throw new Error('Token has expired');
    });
  }

  private configureInvalidTokenScenario(mock: any): void {
    mock.verify.mockImplementation(() => {
      throw new Error('Invalid token signature');
    });
  }

  private configureInsufficientPermissionsScenario(mock: any): void {
    mock.verify.mockReturnValue({
      id: 'admin-456',
      role: 'limited_admin',
      permissions: ['repair_orders.read'], // Limited permissions
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
  }

  resetMock(mock: any): void {
    MockFactory.resetMocks(mock);
  }
}

/**
 * File storage mock strategy
 */
export class FileStorageMockStrategy implements MockStrategy {
  createMock() {
    return {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      getFileUrl: jest.fn(),
      validateFile: jest.fn(),
    };
  }

  configureMock(mock: any, scenario?: string): void {
    switch (scenario) {
      case 'success':
        this.configureSuccessScenario(mock);
        break;
      case 'storage_full':
        this.configureStorageFullScenario(mock);
        break;
      case 'invalid_file':
        this.configureInvalidFileScenario(mock);
        break;
      case 'network_error':
        this.configureNetworkErrorScenario(mock);
        break;
      default:
        this.configureSuccessScenario(mock);
    }
  }

  private configureSuccessScenario(mock: any): void {
    mock.uploadFile.mockResolvedValue({
      success: true,
      fileId: 'file-123',
      url: '/uploads/file-123.jpg',
    });
    mock.deleteFile.mockResolvedValue({ success: true });
    mock.getFileUrl.mockReturnValue('/uploads/file-123.jpg');
    mock.validateFile.mockReturnValue({ valid: true });
  }

  private configureStorageFullScenario(mock: any): void {
    mock.uploadFile.mockRejectedValue(new Error('Storage quota exceeded'));
  }

  private configureInvalidFileScenario(mock: any): void {
    mock.validateFile.mockReturnValue({
      valid: false,
      errors: ['Invalid file type', 'File too large'],
    });
    mock.uploadFile.mockRejectedValue(new Error('Invalid file'));
  }

  private configureNetworkErrorScenario(mock: any): void {
    mock.uploadFile.mockRejectedValue(new Error('Network timeout'));
    mock.deleteFile.mockRejectedValue(new Error('Network timeout'));
  }

  resetMock(mock: any): void {
    MockFactory.resetMocks(mock);
  }
}

/**
 * Mock service provider factory
 */
export class MockServiceProvider {
  /**
   * Create providers for all external services
   */
  static createAllProviders(scenario?: string): Provider[] {
    const strategies = {
      database: new DatabaseMockStrategy(),
      redis: new RedisMockStrategy(),
      sms: new SmsServiceMockStrategy(),
      email: new EmailServiceMockStrategy(),
      telegram: new TelegramServiceMockStrategy(),
      queue: new QueueMockStrategy(),
      auth: new AuthMockStrategy(),
      storage: new FileStorageMockStrategy(),
    };

    return [
      {
        provide: 'KnexConnection',
        useFactory: () => {
          const mock = strategies.database.createMock();
          strategies.database.configureMock(mock, scenario);
          return mock;
        },
      },
      {
        provide: 'RedisClient',
        useFactory: () => {
          const mock = strategies.redis.createMock();
          strategies.redis.configureMock(mock, scenario);
          return mock;
        },
      },
      {
        provide: 'SmsService',
        useFactory: () => {
          const mock = strategies.sms.createMock();
          strategies.sms.configureMock(mock, scenario);
          return mock;
        },
      },
      {
        provide: 'EmailService',
        useFactory: () => {
          const mock = strategies.email.createMock();
          strategies.email.configureMock(mock, scenario);
          return mock;
        },
      },
      {
        provide: 'TelegramService',
        useFactory: () => {
          const mock = strategies.telegram.createMock();
          strategies.telegram.configureMock(mock, scenario);
          return mock;
        },
      },
      {
        provide: 'BullMQQueue',
        useFactory: () => {
          const mock = strategies.queue.createMock();
          strategies.queue.configureMock(mock, scenario);
          return mock;
        },
      },
      {
        provide: 'JwtService',
        useFactory: () => {
          const mock = strategies.auth.createMock();
          strategies.auth.configureMock(mock, scenario);
          return mock;
        },
      },
      {
        provide: 'FileStorageService',
        useFactory: () => {
          const mock = strategies.storage.createMock();
          strategies.storage.configureMock(mock, scenario);
          return mock;
        },
      },
    ];
  }

  /**
   * Create providers for specific services
   */
  static createProvidersFor(services: string[], scenario?: string): Provider[] {
    const allProviders = this.createAllProviders(scenario);
    const serviceMap = {
      database: 'KnexConnection',
      redis: 'RedisClient',
      sms: 'SmsService',
      email: 'EmailService',
      telegram: 'TelegramService',
      queue: 'BullMQQueue',
      auth: 'JwtService',
      storage: 'FileStorageService',
    };

    return allProviders.filter((provider) =>
      services.some((service) => serviceMap[service] === provider.provide),
    );
  }
}

/**
 * Scenario-based test configurations
 */
export class TestScenarios {
  /**
   * Happy path scenario - all services work correctly
   */
  static happyPath(): Provider[] {
    return MockServiceProvider.createAllProviders('success');
  }

  /**
   * Network failure scenario
   */
  static networkFailure(): Provider[] {
    return MockServiceProvider.createAllProviders('error');
  }

  /**
   * Partial failure scenario - some services fail
   */
  static partialFailure(): Provider[] {
    return [
      ...MockServiceProvider.createProvidersFor(['database', 'redis'], 'success'),
      ...MockServiceProvider.createProvidersFor(['sms', 'email'], 'failure'),
      ...MockServiceProvider.createProvidersFor(['telegram', 'queue'], 'success'),
    ];
  }

  /**
   * High load scenario
   */
  static highLoad(): Provider[] {
    return [
      ...MockServiceProvider.createProvidersFor(['database'], 'slow'),
      ...MockServiceProvider.createProvidersFor(['queue'], 'queue_full'),
      ...MockServiceProvider.createProvidersFor(['redis', 'sms', 'email'], 'success'),
    ];
  }

  /**
   * Security scenario - authentication issues
   */
  static securityIssues(): Provider[] {
    return [
      ...MockServiceProvider.createProvidersFor(['auth'], 'expired_token'),
      ...MockServiceProvider.createProvidersFor(['database', 'redis'], 'success'),
    ];
  }
}

/**
 * Mock configuration helper
 */
export class MockConfigurator {
  private static strategies = new Map<string, MockStrategy>();

  static {
    this.strategies.set('database', new DatabaseMockStrategy());
    this.strategies.set('redis', new RedisMockStrategy());
    this.strategies.set('sms', new SmsServiceMockStrategy());
    this.strategies.set('email', new EmailServiceMockStrategy());
    this.strategies.set('telegram', new TelegramServiceMockStrategy());
    this.strategies.set('queue', new QueueMockStrategy());
    this.strategies.set('auth', new AuthMockStrategy());
    this.strategies.set('storage', new FileStorageMockStrategy());
  }

  /**
   * Configure a mock for a specific service and scenario
   */
  static configure(serviceName: string, mock: any, scenario: string): void {
    const strategy = this.strategies.get(serviceName);
    if (strategy) {
      strategy.configureMock(mock, scenario);
    }
  }

  /**
   * Reset all mocks
   */
  static resetAll(mocks: Record<string, any>): void {
    Object.entries(mocks).forEach(([serviceName, mock]) => {
      const strategy = this.strategies.get(serviceName);
      if (strategy) {
        strategy.resetMock(mock);
      }
    });
  }

  /**
   * Verify mock interactions
   */
  static verifyInteractions(serviceName: string, mock: any, expectations: any): void {
    switch (serviceName) {
      case 'database':
        this.verifyDatabaseInteractions(mock, expectations);
        break;
      case 'sms':
        this.verifySmsInteractions(mock, expectations);
        break;
      case 'email':
        this.verifyEmailInteractions(mock, expectations);
        break;
      // Add more verification methods as needed
    }
  }

  private static verifyDatabaseInteractions(mock: any, expectations: any): void {
    if (expectations.insertCalled) {
      expect(mock.insert).toHaveBeenCalled();
    }
    if (expectations.updateCalled) {
      expect(mock.update).toHaveBeenCalled();
    }
    if (expectations.transactionUsed) {
      expect(mock.transaction).toHaveBeenCalled();
    }
  }

  private static verifySmsInteractions(mock: any, expectations: any): void {
    if (expectations.smsSent) {
      expect(mock.sendSms).toHaveBeenCalledWith(expectations.phoneNumber, expectations.message);
    }
  }

  private static verifyEmailInteractions(mock: any, expectations: any): void {
    if (expectations.emailSent) {
      expect(mock.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expectations.recipient,
          subject: expectations.subject,
        }),
      );
    }
  }
}
