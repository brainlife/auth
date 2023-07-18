import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import * as redisMock from 'redis-mock';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let redisClientMock: redisMock.RedisClient;

  beforeEach(async () => {
    redisClientMock = {
      set: jest.fn(),
      get: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: 'REDIS_CLIENT',
          useValue: redisMock.createClient(),
        },
      ],
    }).compile();

    redisClientMock = module.get('REDIS_CLIENT');
    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});