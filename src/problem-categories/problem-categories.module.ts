import { Module } from '@nestjs/common';
import { ProblemCategoriesService } from './problem-categories.service';
import { ProblemCategoriesController } from './problem-categories.controller';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
  imports: [PermissionsModule],
  controllers: [ProblemCategoriesController],
  providers: [ProblemCategoriesService],
})
export class ProblemCategoriesModule {}
