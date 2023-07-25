import { Inject, Injectable } from '@nestjs/common';
import { RedisClient } from './redis.provider';

@Injectable()
export class RedisService {
  public constructor(
    @Inject('REDIS_CLIENT')
    private readonly client: RedisClient,
  ) {}

  async set(key: string, value: string, expirationSeconds: number) {
    try {
      const result = await this.client.set(key, value, 'EX', expirationSeconds);
      console.log('Redis SET operation result:', result);
      console.log('Redis SET operation successful for key:', key);
      return result;
    } catch (error) {
      console.error('Error while performing Redis SET operation:', error);
      throw error; // Rethrow the error to propagate it to the caller, if needed.
    }  
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async keys(key:string): Promise<string[]> {
    return this.client.keys(key);
  }

  async del(key: string) {
    return this.client.del(key);
  }

  ping() {
    return this.client.ping();
  }
}
