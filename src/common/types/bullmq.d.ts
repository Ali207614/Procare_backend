import 'bullmq';

declare module 'bullmq' {
  interface QueueOptions {
    connection?: {
      host: string;
      port: number;
      password?: string;
      db?: number;
    };
    limiter?: {
      max: number;
      duration: number;
      groupKey?: string;
    };
  }
}
