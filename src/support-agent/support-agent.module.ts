import { Module } from '@nestjs/common';
import { SupportAgentController } from './support-agent.controller';

@Module({
  controllers: [SupportAgentController],
})
export class SupportAgentModule {}
