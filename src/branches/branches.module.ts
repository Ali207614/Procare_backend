import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';

@Module({
    imports: [RedisModule],
    controllers: [
        BranchesController,],
    providers: [
        BranchesService,],
})
export class BranchesModule { }
