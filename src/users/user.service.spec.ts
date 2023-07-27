import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getModelToken } from '@nestjs/mongoose'; // Import this to get the model token for MongoDB

// Create a mock UserModel
class UserModelMock {}

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        // Provide the UserModelMock using the getModelToken() function
        { provide: getModelToken('User'), useClass: UserModelMock },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
