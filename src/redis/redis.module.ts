import { Module } from '@nestjs/common';
import { redisProvider } from './redis.provider';
import { RedisService } from './redis.service';
import { redisClientFactory } from './redis-client.factory';

@Module({
  providers: [redisProvider, RedisService,redisClientFactory],
  exports: [RedisService],
})
export class RedisModule {}
