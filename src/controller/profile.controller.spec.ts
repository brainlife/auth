import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { UserService } from '../users/user.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { GroupService } from '../groups/group.service';
import { UserServiceMock } from './root.controller.spec';
import { GroupServiceMock } from './root.controller.spec';
import { QueuePublisherMock } from './root.controller.spec';
import { RedisService } from '../redis/redis.service';

import { safe_fields } from './profile.controller';

class RedisServiceMock {
    get = jest.fn();
    set = jest.fn();
    keys = jest.fn();
    delete = jest.fn();
}
// Mock the checkUser function to resolve to null or undefined
jest.mock('../utils/common.utils', () => ({
    checkUser: jest.fn().mockResolvedValue(null),
    sendEmailConfirmation: jest.fn().mockResolvedValue(undefined),
    createClaim: jest.fn().mockResolvedValue({}),
    signJWT: jest.fn().mockReturnValue('mocked-jwt-token'),
    hasScope: jest.fn().mockReturnValue(true),
    queuePublisher: {
      publishToQueue: jest.fn(),
    },
  }));

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
  let redisService: RedisServiceMock;
  let res: { json: jest.Mock<any, any>; status: jest.Mock<any, any> };

  beforeEach(async () => {


    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        { provide: UserService, useClass: UserServiceMock },
        { provide: GroupService, useClass: GroupServiceMock },
        { provide: 'RABBITMQ_SERVICE', useClass: ClientProxyMock },
        { provide: RedisService , useClass: RedisServiceMock },
        {
          provide: 'QUEUE_PUBLISHER', // Use the correct token name
          useClass: QueuePublisherMock, // Use the mock class
        },
      ],
    }).compile();

    profileController = module.get<ProfileController>(ProfileController);
    userService = module.get<UserServiceMock>(UserService);
    groupService = module.get<GroupServiceMock>(GroupService);
    redisService = module.get<RedisServiceMock>(RedisService);
    // Initialize the 'res' mock
    res = { json: jest.fn(), status: jest.fn(() => res) };
  });

  describe('getProfile', () => {
    it('should return a user profile when a user exists', async () => {
      // Arrange
      const request = {
        user: { sub: 1 },
        params: {}
      };
      const expectedUser = { 
        sub: 1,
        'profile.private': 'Some Private Profile Data'
      };
      userService.findOnebySub.mockResolvedValue(expectedUser);
      
      // Act
      await profileController.getProfile(request as any, res as any);

      // Assert
      expect(userService.findOnebySub).toHaveBeenCalledWith(1, [...safe_fields, 'profile.private']);
      expect(res.json).toHaveBeenCalledWith(expectedUser);
    });

    it('should throw an exception when a user does not exist', async () => {
      // Arrange
      const request = {
        user: { sub: 1 },
        params: {}
      };
      userService.findOnebySub.mockResolvedValue(null);
      
      // Act
      await expect(profileController.getProfile(request as any, res as any)).rejects.toThrow(HttpException);

      // Assert
      expect(userService.findOnebySub).toHaveBeenCalledWith(1, [...safe_fields, 'profile.private']);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should update and return the user profile', async () => {
      // Arrange
      const request = {
        params: { sub: 123 },
        body: {
          fullname: 'New Fullname',
          profile: {
            public: { key: 'newValue' },
            private: { privateKey: 'newPrivateValue' },
          },
        },
      };
      const user = {
        sub: 123,
        fullname: 'Old Fullname',
        profile: {
          public: { key: 'oldValue' },
          private: { privateKey: 'oldPrivateValue' },
        },
      };
      userService.findOnebySub.mockResolvedValue(user);
      userService.updatebySub.mockResolvedValue(undefined);

      // Act
      await profileController.updateProfile(request as any, res as any);

      // Assert
      expect(userService.findOnebySub).toHaveBeenCalledWith(request.params.sub, [...safe_fields, 'profile.private']);
      expect(user.fullname).toBe(request.body.fullname);
      expect(user.profile.public.key).toBe(request.body.profile.public.key);
      expect(user.profile.private.privateKey).toBe(request.body.profile.private.privateKey);
      expect(userService.updatebySub).toHaveBeenCalledWith(user.sub, user);
    //   expect(queuePublisher.publishToQueue).toHaveBeenCalledWith('user.update.' + user.sub, request.body);
      expect(res.json).toHaveBeenCalledWith(user);
    });
    it('should throw error when user does not exist', async () => {
        // Arrange
        const request = {
          params: { sub: 123 },
          body: {
            fullname: 'New Fullname',
            profile: {
              public: { key: 'newValue' },
              private: { privateKey: 'newPrivateValue' },
            },
          },
        };
        userService.findOnebySub.mockResolvedValue(null);
  
        // Act and Assert
        await expect(profileController.updateProfile(request as any, res as any))
          .rejects
          .toThrow(new HttpException('no such active user', HttpStatus.NOT_FOUND));
      });
  });
  describe('getRecentUsers', () => {
    it('should return users registered within last days provided', async () => {
      // Arrange
      const request = {
        params: { days: '10' },
      };
      const mockedUsers = [
        { sub: '1', times: { register: new Date() } },
        { sub: '2', times: { register: new Date() } },
      ];
      userService.findAll.mockResolvedValue(mockedUsers);
      const expectedTargetDate = new Date();
      expectedTargetDate.setDate(expectedTargetDate.getDate() - 10);
  
      // Act
      await profileController.getRecentUsers(request as any, res as any);
  
      // Assert
      expect(userService.findAll).toHaveBeenCalledWith(
        { 'times.register': { $gt: expectedTargetDate }, email_confirmed: true },
        safe_fields,
        'times.register',
      );

    // in case the above test fails, use this one
    //   expect(userService.findAll).toHaveBeenCalledWith(
    //     { 'times.register': { $gt: expectedTargetDate.toISOString() }, email_confirmed: true },
    //     safe_fields,
    //     'times.register',
    //   );
      
      expect(res.json).toHaveBeenCalledWith({ users: mockedUsers });
    });
    it('should throw error for invalid days', async () => {
        // Arrange
        const request = {
          params: { days: 'abc' }, // Invalid days
        };
    
        try {
          // Act
          await profileController.getRecentUsers(request as any, res as any);
        } catch (err) {
          // Assert
          expect(err).toBeInstanceOf(HttpException);
          expect(err.status).toEqual(HttpStatus.BAD_REQUEST);
        }
     });
    it('should only return users with confirmed email', async () => {
        // Arrange
        const request = {
          params: { days: '10' },
        };
        const mockedUsers = [
          { sub: '1', times: { register: new Date() }, email_confirmed: true },
          { sub: '2', times: { register: new Date() }, email_confirmed: false }, // User with unconfirmed email
        ];
        userService.findAll.mockResolvedValue(mockedUsers);
    
        // Act
        await profileController.getRecentUsers(request as any, res as any);
    
        // Assert
        expect(res.json).toHaveBeenCalledWith({ users: mockedUsers });
    });
  });
  

});
