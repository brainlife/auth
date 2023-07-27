import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../users/user.service'; // Import the UserService
import { RedisService } from '../redis/redis.service'; // Import the RedisService

// Create mock classes for dependencies
class UserServiceMock {}
class RedisServiceMock {}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useClass: UserServiceMock }, // Provide the UserServiceMock
        { provide: RedisService, useClass: RedisServiceMock }, // Provide the RedisServiceMock
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
