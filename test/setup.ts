import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  console.log('🧪 Starting test suite...');
});

afterAll(async () => {
  console.log('✅ Test suite completed');
});
