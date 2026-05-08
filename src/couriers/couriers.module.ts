import { CouriersController } from './couriers.controller';
import { Module } from '@nestjs/common';
import { CouriersService } from './couriers.service';

@Module({
  imports: [],
  controllers: [CouriersController],
  providers: [CouriersService],
})
export class CouriersModule {}
