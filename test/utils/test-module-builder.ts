import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { TestHelpers } from './test-helpers';
import { MockFactory } from './mock-factory';

/**
 * Builder class for creating test modules with common configurations
 * Follows the Builder pattern for flexible test setup
 */
export class TestModuleBuilder {
  private providers: any[] = [];
  private controllers: any[] = [];
  private imports: any[] = [];
  private guardOverrides: Map<any, any> = new Map();
  private pipeOverrides: Map<any, any> = new Map();
  private interceptorOverrides: Map<any, any> = new Map();

  static create(): TestModuleBuilder {
    return new TestModuleBuilder();
  }

  /**
   * Add providers to the test module
   */
  addProviders(providers: any[]): TestModuleBuilder {
    this.providers.push(...providers);
    return this;
  }

  /**
   * Add controllers to the test module
   */
  addControllers(controllers: any[]): TestModuleBuilder {
    this.controllers.push(...controllers);
    return this;
  }

  /**
   * Add imports to the test module
   */
  addImports(imports: any[]): TestModuleBuilder {
    this.imports.push(...imports);
    return this;
  }

  /**
   * Override a guard with a mock implementation
   */
  overrideGuard(guard: any, mock?: any): TestModuleBuilder {
    this.guardOverrides.set(guard, mock || MockFactory.createMockGuard());
    return this;
  }

  /**
   * Override a pipe with a mock implementation
   */
  overridePipe(pipe: any, mock?: any): TestModuleBuilder {
    this.pipeOverrides.set(pipe, mock || MockFactory.createMockPipe());
    return this;
  }

  /**
   * Override an interceptor with a mock implementation
   */
  overrideInterceptor(interceptor: any, mock?: any): TestModuleBuilder {
    this.interceptorOverrides.set(interceptor, mock || MockFactory.createMockInterceptor());
    return this;
  }

  /**
   * Add database mocks (Knex and Redis)
   */
  withDatabaseMocks(): TestModuleBuilder {
    this.providers.push(
      { provide: 'KnexConnection', useValue: MockFactory.createMockKnex() },
      { provide: 'RedisClient', useValue: MockFactory.createMockRedis() },
    );
    return this;
  }

  /**
   * Add authentication mocks
   */
  withAuthMocks(): TestModuleBuilder {
    this.providers.push(
      { provide: 'JwtService', useValue: MockFactory.createMockJwtService() },
      { provide: 'PassportService', useValue: MockFactory.createMockPassportService() },
    );
    return this;
  }

  /**
   * Add external service mocks
   */
  withExternalServiceMocks(): TestModuleBuilder {
    this.providers.push(
      { provide: 'TelegramService', useValue: MockFactory.createMockTelegramService() },
      { provide: 'EmailService', useValue: MockFactory.createMockEmailService() },
      { provide: 'SmsService', useValue: MockFactory.createMockSmsService() },
    );
    return this;
  }

  /**
   * Add queue mocks
   */
  withQueueMocks(): TestModuleBuilder {
    this.providers.push(
      { provide: 'BullQueue', useValue: MockFactory.createMockQueue() },
      { provide: 'BullMQQueue', useValue: MockFactory.createMockBullMQQueue() },
    );
    return this;
  }

  /**
   * Build the test module
   */
  async build(): Promise<TestingModule> {
    const moduleBuilder = Test.createTestingModule({
      controllers: this.controllers,
      providers: this.providers,
      imports: this.imports,
    });

    // Apply guard overrides
    this.guardOverrides.forEach((mock, guard) => {
      moduleBuilder.overrideGuard(guard).useValue(mock);
    });

    // Apply pipe overrides
    this.pipeOverrides.forEach((mock, pipe) => {
      moduleBuilder.overridePipe(pipe).useValue(mock);
    });

    // Apply interceptor overrides
    this.interceptorOverrides.forEach((mock, interceptor) => {
      moduleBuilder.overrideInterceptor(interceptor).useValue(mock);
    });

    return moduleBuilder.compile();
  }

  /**
   * Build and create a full NestJS application for integration tests
   */
  async buildApp(): Promise<INestApplication> {
    const moduleBuilder = Test.createTestingModule({
      imports: [AppModule, ...this.imports],
    });

    // Apply overrides
    this.guardOverrides.forEach((mock, guard) => {
      moduleBuilder.overrideGuard(guard).useValue(mock);
    });

    this.providers.forEach((provider) => {
      if (provider.provide && provider.useValue) {
        moduleBuilder.overrideProvider(provider.provide).useValue(provider.useValue);
      }
    });

    const module = await moduleBuilder.compile();
    const app = module.createNestApplication();

    // Apply global configurations
    TestHelpers.configureTestApp(app);

    await app.init();
    return app;
  }
}

/**
 * Predefined test module configurations
 */
export class TestModuleConfigurations {
  /**
   * Standard unit test configuration
   */
  static forUnitTest(serviceClass: any): TestModuleBuilder {
    return TestModuleBuilder.create()
      .addProviders([serviceClass])
      .withDatabaseMocks()
      .withAuthMocks();
  }

  /**
   * Controller test configuration with all common dependencies
   */
  static forControllerTest(controllerClass: any, serviceClass: any): TestModuleBuilder {
    return TestModuleBuilder.create()
      .addControllers([controllerClass])
      .addProviders([
        { provide: serviceClass, useValue: MockFactory.createMockService(serviceClass) },
      ])
      .withAuthMocks()
      .withDatabaseMocks();
  }

  /**
   * Integration test configuration
   */
  static forIntegrationTest(): TestModuleBuilder {
    return TestModuleBuilder.create()
      .withDatabaseMocks()
      .withAuthMocks()
      .withExternalServiceMocks()
      .withQueueMocks();
  }

  /**
   * E2E test configuration
   */
  static forE2ETest(): TestModuleBuilder {
    return TestModuleBuilder.create().withExternalServiceMocks(); // Only mock external services for E2E
  }

  /**
   * Service test with specific dependencies
   */
  static forServiceTest(serviceClass: any, dependencies: any[] = []): TestModuleBuilder {
    const builder = TestModuleBuilder.create().addProviders([serviceClass]).withDatabaseMocks();

    // Add specific dependencies
    dependencies.forEach((dep) => {
      builder.addProviders([
        {
          provide: dep,
          useValue: MockFactory.createMockService(dep),
        },
      ]);
    });

    return builder;
  }
}

/**
 * Test scenario builder for creating specific test scenarios
 */
export class TestScenarioBuilder {
  private scenarios: Map<string, any> = new Map();

  static create(): TestScenarioBuilder {
    return new TestScenarioBuilder();
  }

  /**
   * Add a test scenario
   */
  addScenario(name: string, setup: any): TestScenarioBuilder {
    this.scenarios.set(name, setup);
    return this;
  }

  /**
   * Get a specific scenario
   */
  getScenario(name: string): any {
    return this.scenarios.get(name);
  }

  /**
   * Run all scenarios
   */
  getAllScenarios(): Map<string, any> {
    return this.scenarios;
  }
}

/**
 * Common test scenarios for repair orders
 */
export class RepairOrderTestScenarios {
  static getScenarios(): TestScenarioBuilder {
    return TestScenarioBuilder.create()
      .addScenario('newRepairOrder', {
        device_type: 'iPhone 14',
        initial_problem: 'Cracked screen',
        customer_name: 'John Doe',
        customer_phone: '+1234567890',
        status: 'Open',
      })
      .addScenario('inProgressRepairOrder', {
        device_type: 'Samsung Galaxy S23',
        initial_problem: 'Battery issue',
        customer_name: 'Jane Smith',
        customer_phone: '+0987654321',
        status: 'In Progress',
        assigned_admin_id: 'admin-123',
      })
      .addScenario('completedRepairOrder', {
        device_type: 'iPad Pro',
        initial_problem: 'Screen not responding',
        customer_name: 'Bob Johnson',
        customer_phone: '+1122334455',
        status: 'Completed',
        completion_date: new Date(),
        final_cost: 250.0,
      });
  }
}

/**
 * Test data builder for creating consistent test data
 */
export class TestDataBuilder {
  private data: any = {};

  static create(): TestDataBuilder {
    return new TestDataBuilder();
  }

  /**
   * Set field value
   */
  set(field: string, value: any): TestDataBuilder {
    this.data[field] = value;
    return this;
  }

  /**
   * Set multiple fields
   */
  setMultiple(fields: Record<string, any>): TestDataBuilder {
    Object.assign(this.data, fields);
    return this;
  }

  /**
   * Apply a preset configuration
   */
  applyPreset(preset: any): TestDataBuilder {
    Object.assign(this.data, preset);
    return this;
  }

  /**
   * Build the final data object
   */
  build(): any {
    return { ...this.data };
  }

  /**
   * Build with overrides
   */
  buildWith(overrides: any): any {
    return { ...this.data, ...overrides };
  }
}

/**
 * Test assertion helpers
 */
export class TestAssertions {
  /**
   * Assert that object has required fields
   */
  static hasRequiredFields(object: any, fields: string[]): void {
    fields.forEach((field) => {
      expect(object).toHaveProperty(field);
      expect(object[field]).toBeDefined();
    });
  }

  /**
   * Assert that response has pagination structure
   */
  static hasPaginationStructure(response: any): void {
    expect(response).toHaveProperty('data');
    expect(response).toHaveProperty('meta');
    expect(response.meta).toHaveProperty('total');
    expect(response.meta).toHaveProperty('limit');
    expect(response.meta).toHaveProperty('offset');
    expect(Array.isArray(response.data)).toBe(true);
  }

  /**
   * Assert that error response has correct structure
   */
  static hasErrorStructure(error: any, expectedMessage?: string): void {
    expect(error).toHaveProperty('message');
    if (expectedMessage) {
      expect(error.message).toContain(expectedMessage);
    }
  }

  /**
   * Assert that audit fields are present
   */
  static hasAuditFields(object: any): void {
    expect(object).toHaveProperty('created_at');
    expect(object).toHaveProperty('updated_at');
    expect(object).toHaveProperty('created_by');
  }

  /**
   * Assert that timestamps are valid
   */
  static hasValidTimestamps(object: any): void {
    if (object.created_at) {
      expect(new Date(object.created_at)).toBeInstanceOf(Date);
    }
    if (object.updated_at) {
      expect(new Date(object.updated_at)).toBeInstanceOf(Date);
    }
  }
}

/**
 * Test performance helpers
 */
export class TestPerformance {
  /**
   * Measure execution time of a function
   */
  static async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  }

  /**
   * Assert that operation completes within time limit
   */
  static async assertTimeLimit<T>(fn: () => Promise<T>, maxTime: number): Promise<T> {
    const { result, duration } = await this.measureTime(fn);
    expect(duration).toBeLessThan(maxTime);
    return result;
  }

  /**
   * Benchmark multiple functions
   */
  static async benchmark(tests: Array<{ name: string; fn: () => Promise<any> }>): Promise<any[]> {
    const results = [];

    for (const test of tests) {
      const { result, duration } = await this.measureTime(test.fn);
      results.push({
        name: test.name,
        duration,
        result,
      });
    }

    return results;
  }
}
