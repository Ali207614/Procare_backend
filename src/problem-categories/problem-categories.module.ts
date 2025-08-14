import { Module } from '@nestjs/common';
import { ProblemCategoriesService } from './problem-categories.service';
import { ProblemCategoriesController } from './problem-categories.controller';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { LoggerModule } from 'src/common/logger/logger.module';

@Module({
  imports: [PermissionsModule, RedisModule, LoggerModule],
  controllers: [ProblemCategoriesController],
  providers: [ProblemCategoriesService],
})
export class ProblemCategoriesModule {}
