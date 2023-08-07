import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import * as redisMock from 'redis-mock';
import { RedisService } from './redis.service';
import e from 'express';

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

  // describe('set', () => {
  //   it('should call redisClient.set', () => {
  //     service.set('key', 'value', 1000);
  //     expect(service.get('key')).toEqual('value');
  //   });
  // }
  // );

  // describe('get', () => {
  //   it('should call redisClient.get', () => {
  //     service.get('key');
  //     expect(redisClientMock.get).toHaveBeenCalledWith('key');
  //   });
  // });

  // describe('del', () => {
  //   it('should call redisClient.del', () => {
  //     service.del('key');
  //     expect(redisClientMock.del).toHaveBeenCalledWith('key');
  //   });
  // });

  // describe('keys', () => {
  //   it('should call redisClient.keys', () => {
  //     service.set('key', 'value', 1000);
  //     const keys = service.keys('key');
  //     expect(keys).toEqual(['key']);
  //   });
  // }
  // );

});
