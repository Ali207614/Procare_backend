import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { WorkerAppModule } from 'src/campaigns/worker-app.module';
import { CampaignsJobHandler } from 'src/campaigns/campaigns.job-handler';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const handler: CampaignsJobHandler = app.get(CampaignsJobHandler);

  const worker = new Worker('campaigns', async (job) => handler.process(job), {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    },
    limiter: { max: 20, duration: 1000 },
    // concurrency: 50,
  });
  console.log(
    '[WORKER] DB_* =',
    process.env.DB_HOST,
    process.env.DB_PORT,
    process.env.DB_USER,
    process.env.DB_NAME,
  );

  worker.on('ready', () => console.log(`[WORKER] ready`));
  worker.on('error', (e) => console.error(`[WORKER] error`, e));
  worker.on('completed', (job) => console.log(`[WORKER] completed ${job.id}`));
  worker.on('failed', (job, err) => console.error(`[WORKER] failed ${job?.id}`, err));

  console.log('📨 Campaigns Worker started with limiter 20/s …');
  await new Promise(() => {}); // keep alive
}

bootstrap().catch((err) => {
  console.error('❌ Worker bootstrap failed:', err);
  process.exit(1);
});
