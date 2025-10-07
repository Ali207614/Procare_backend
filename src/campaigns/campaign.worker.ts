import 'dotenv/config';
console.log('[worker] file loaded'); // <- 0

import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from 'src/campaigns/worker-app.module';

async function bootstrap(): Promise<void> {
  try {
    console.log('[worker] bootstrap start'); // <- 1

    const app = await NestFactory.createApplicationContext(WorkerAppModule, {
      logger: ['log', 'warn', 'error'],
    });

    console.log('[worker] Nest context created'); // <- 2

    // Agar LoggerService bo'lsa, ko'rsatamiz (ixtiyoriy)
    try {
      const logger = app.get<any>('LoggerService');
      logger?.log?.('🧵 Campaigns worker started. Listening to "campaigns" queue...');
    } catch {
      console.log('[worker] LoggerService not resolved (ok for test)');
    }

    console.log('[worker] entering keep-alive'); // <- 3
    // processni tirik ushlab turish
    await new Promise(() => {});
  } catch (e) {
    console.error('❌ Worker bootstrap failed:', e);
    process.exit(1);
  }
}

bootstrap();
