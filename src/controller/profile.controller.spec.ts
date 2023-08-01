import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { UserService } from '../users/user.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { GroupService } from '../groups/group.service';
import { UserServiceMock } from './root.controller.spec';
import { GroupServiceMock } from './root.controller.spec';
import { QueuePublisherMock } from './root.controller.spec';

class RedisServiceMock {}

class ClientProxyMock {
  emit = jest.fn().mockResolvedValue(undefined);
  connect = jest.fn().mockResolvedValue(undefined);
}

beforeEach(() => {
  jest.clearAllMocks(); // clear all mocks
});

describe('ProfileController', () => {
  let profileController: ProfileController;
  let userService: UserServiceMock;
  let groupService: GroupServiceMock;
  let res: { json: jest.Mock<any, any>; status: jest.Mock<any, any> };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        { provide: UserService, useClass: UserServiceMock },
        { provide: GroupService, useClass: GroupServiceMock },
        { provide: 'RABBITMQ_SERVICE', useClass: ClientProxyMock },
        { provide: 'REDIS_SERVICE', useClass: RedisServiceMock },
        {
          provide: 'QUEUE_PUBLISHER', // Use the correct token name
          useClass: QueuePublisherMock, // Use the mock class
        },
      ],
    }).compile();

    profileController = module.get<ProfileController>(ProfileController);
    userService = module.get<UserServiceMock>(UserService);
    groupService = module.get<GroupServiceMock>(GroupService);
    // Initialize the 'res' mock
    res = { json: jest.fn(), status: jest.fn(() => res) };
  });

  it('should be defined', () => {
    expect(profileController).toBeDefined();
  });

  // Your test cases go here...
});
