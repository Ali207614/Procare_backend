import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../src/logger.service';

// Mock winston
const mockWinstonLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  log: jest.fn(),
};

jest.mock('winston', () => ({
  createLogger: jest.fn(() => mockWinstonLogger),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    DailyRotateFile: jest.fn(),
  },
}));

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggerService],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should log info message', () => {
      // Arrange
      const message = 'Test info message';

      // Act
      service.log(message);

      // Assert
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(message);
    });

    it('should log info message with context', () => {
      // Arrange
      const message = 'Test info message';
      const context = 'TestContext';

      // Act
      service.log(message, context);

      // Assert
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(message, { context });
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      // Arrange
      const message = 'Test error message';

      // Act
      service.error(message);

      // Assert
      expect(mockWinstonLogger.error).toHaveBeenCalledWith(message);
    });

    it('should log error with stack trace', () => {
      // Arrange
      const message = 'Test error message';
      const trace = 'Error stack trace';

      // Act
      service.error(message, trace);

      // Assert
      expect(mockWinstonLogger.error).toHaveBeenCalledWith(message, { trace });
    });

    it('should log error with context', () => {
      // Arrange
      const message = 'Test error message';
      const trace = 'Error stack trace';
      const context = 'TestContext';

      // Act
      service.error(message, trace, context);

      // Assert
      expect(mockWinstonLogger.error).toHaveBeenCalledWith(message, { trace, context });
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      // Arrange
      const message = 'Test warning message';

      // Act
      service.warn(message);

      // Assert
      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(message);
    });

    it('should log warning with context', () => {
      // Arrange
      const message = 'Test warning message';
      const context = 'TestContext';

      // Act
      service.warn(message, context);

      // Assert
      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(message, { context });
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      // Arrange
      const message = 'Test debug message';

      // Act
      service.debug(message);

      // Assert
      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(message);
    });

    it('should log debug with context', () => {
      // Arrange
      const message = 'Test debug message';
      const context = 'TestContext';

      // Act
      service.debug(message, context);

      // Assert
      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(message, { context });
    });
  });

  describe('verbose', () => {
    it('should log verbose message', () => {
      // Arrange
      const message = 'Test verbose message';

      // Act
      service.verbose(message);

      // Assert
      expect(mockWinstonLogger.verbose).toHaveBeenCalledWith(message);
    });

    it('should log verbose with context', () => {
      // Arrange
      const message = 'Test verbose message';
      const context = 'TestContext';

      // Act
      service.verbose(message, context);

      // Assert
      expect(mockWinstonLogger.verbose).toHaveBeenCalledWith(message, { context });
    });
  });

  describe('error handling', () => {
    it('should handle logger errors gracefully', () => {
      // Arrange
      mockWinstonLogger.error.mockImplementation(() => {
        throw new Error('Logger error');
      });

      // Act & Assert
      expect(() => service.error('Test message')).not.toThrow();
    });
  });
});