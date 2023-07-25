import { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient>;
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');