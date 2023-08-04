import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export type RedisClient = Redis;

export const redisProvider: Provider = {
  useFactory: (): RedisClient => {
    return new Redis({
      host: 'redis',
      port: 6379,
    });
  },
  provide: 'REDIS_CLIENT',
};
