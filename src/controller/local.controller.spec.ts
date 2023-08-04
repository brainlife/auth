import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '../users/user.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { GroupService } from '../groups/group.service';
import { UserServiceMock } from './root.controller.spec';
import { GroupServiceMock } from './root.controller.spec';
import { RedisService } from '../redis/redis.service';
import { FailedLoginService 
} from '../failedLogins/failedLogin.service';
import { LocalController
 } from './local.controller';
import * as utilModule from '../utils/common.utils';
import { AuthService } from '../auth/auth.service';


class RedisServiceMock {
    get = jest.fn();
    set = jest.fn();
    keys = jest.fn();
    del = jest.fn();
}

class AuthServiceMock {
    validateUser = jest.fn().mockResolvedValue({});
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
    hashPassword: jest.fn().mockResolvedValue('mocked-password'),
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetConfirmation: jest.fn().mockResolvedValue(undefined),
    sendEmailConfirmationConfirmation: jest.fn().mockResolvedValue(undefined),
    sendEmailChangeConfirmation: jest.fn().mockResolvedValue(undefined),

  }));


export class FailedLoginServiceMock {
    create = jest.fn().mockResolvedValue({some: 'value'});
    delete = jest.fn().mockResolvedValue({});
    findOne = jest.fn().mockResolvedValue({});
    update = jest.fn().mockResolvedValue({});
    find = jest.fn().mockResolvedValue({});
}

beforeEach(() => {
  jest.clearAllMocks(); // clear all mocks
});

describe('ProfileController', () => {
  let localController: LocalController;
  let userService: UserServiceMock;
  let groupService: GroupServiceMock;
  let redisService: RedisServiceMock;
  let failedLoginService: FailedLoginServiceMock;

  let res: { cookie: jest.Mock<any,any> ; json: jest.Mock<any, any>; status: jest.Mock<any, any> };
  let response = { 
    cookie: jest.fn(),
    json: jest.fn(),
  };
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocalController],
      providers: [
        { provide: UserService, useClass: UserServiceMock },
        { provide: RedisService , useClass: RedisServiceMock },
        { provide: GroupService, useClass: GroupServiceMock },
        { provide: FailedLoginService, useClass: FailedLoginServiceMock}
      ],
    }).compile();

    localController = module.get<LocalController>(LocalController);
    userService = module.get<UserServiceMock>(UserService);
    groupService = module.get<GroupServiceMock>(GroupService);
    redisService = module.get<RedisServiceMock>(RedisService);
    failedLoginService = module.get<FailedLoginServiceMock>(FailedLoginService);
    // Initialize the 'res' mock
    res = { cookie: jest.fn(), json: jest.fn(), status: jest.fn(() => res) };
    response = {
        cookie: jest.fn(),
        json: jest.fn(),
    };
});

describe('resetPass', () => {
    it('should generate reset tokens and send a reset password email', async () => {
      // Arrange
      const request = { cookies: {} };
      const body = { email: 'test@mail.com', token: null, password: null }; // Include all properties
      const user = {
        sub: 1,
        email: 'test@mail.com',
        password_reset_token: '',
        password_reset_cookie: ''
      };
      userService.findByEmail.mockResolvedValue(user);
      userService.updatebySub.mockResolvedValue(null);

      // Act
      await localController.resetPass(request as any, res as any, body);
  
      // Assert
      expect(userService.findByEmail).toHaveBeenCalledWith(body.email);
      expect(user.password_reset_token).not.toEqual('');
      expect(user.password_reset_cookie).not.toEqual('');
      expect(userService.updatebySub).toHaveBeenCalledWith(user.sub, user);
      expect(res.json).toHaveBeenCalledWith({ message: 'Reset token sent' });
    });
  
    it('should reset password with valid token', async () => {
      // Arrange
      const request = { cookies: {} };
      const body = { email: null, token: 'validToken', password: 'newPassword' }; // Include all properties
      const user = {
        sub: 1,
        password_reset_token: 'validToken',
        password_hash: 'oldPassword',
        password_reset_cookie: null,
        times: {}
      };
      userService.findOne.mockResolvedValue(user);
      userService.updatebySub.mockResolvedValue(null);
  
      // Act
      await localController.resetPass(request as any, res as any, body);
  
      // Assert
      expect(userService.findOne).toHaveBeenCalledWith({ password_reset_token: body.token });
      expect(user.password_hash).not.toEqual('oldPassword');
      expect(user.password_reset_token).toBe(null);
      expect(user.password_reset_cookie).toBe(null);
      expect(userService.updatebySub).toHaveBeenCalledWith(user.sub, user);
      expect(res.json).toHaveBeenCalledWith({ message: 'Password reset successfully' });
    });
  });

  
  describe('unlockUser', () => {
    it('should unlock user by deleting failed login attempts', async () => {
        // Arrange
        const request = { params: { id: '1' } };
        const user = { username: 'testuser', sub: '1' };
        const failedLoginKeys = ['auth.fail.' + user.username + '.1', 'auth.fail.' + user.username + '.2'];

        userService.findOnebySub.mockResolvedValue(user);
        redisService.keys.mockResolvedValue(failedLoginKeys);

        // Act
        await localController.unlockUser(request as any, response as any);

        // Assert
        expect(userService.findOnebySub).toHaveBeenCalledWith(request.params.id);
        expect(redisService.keys).toHaveBeenCalledWith('auth.fail.' + user.username + '.*');
        expect(redisService.del).toHaveBeenCalledTimes(failedLoginKeys.length);
        failedLoginKeys.forEach(failedLoginKey => {
            expect(redisService.del).toHaveBeenCalledWith(failedLoginKey);
        });
        expect(response.json).toHaveBeenCalledWith({ status: 'ok', message: 'Account unlocked' });
    });

    it('should throw an error if no user is found', async () => {
        // Arrange
        const request = { params: { id: '1' } };
        
        userService.findOnebySub.mockResolvedValue(null);

        // Act & Assert
        await expect(localController.unlockUser(request as any, response as any))
            .rejects.toThrow(new HttpException('No such user registered', HttpStatus.NOT_FOUND));
    });

    it('should throw an error if no failed login attempts are found', async () => {
        // Arrange
        const request = { params: { id: '1' } };
        const user = { username: 'testuser', sub: '1' };

        userService.findOnebySub.mockResolvedValue(user);
        redisService.keys.mockResolvedValue([]);

        // Act & Assert
        await expect(localController.unlockUser(request as any, response as any))
            .rejects.toThrow(new HttpException('Account already unlocked', HttpStatus.NOT_FOUND));
    });
});

describe('localLogin', () => {
  const mockAuthService = {
    validateUser: jest.fn()
  };

  beforeEach(() => {
    mockAuthService.validateUser.mockReset();
    jest.clearAllMocks(); // clear all mocks
  });

  it('should return an error message when credentials are invalid', async () => {
    mockAuthService.validateUser.mockResolvedValue({ message: 'Invalid credentials', code: 'bad_username' });
    redisService.set = jest.fn().mockResolvedValue('OK'); // Mock the set method
  
    const req = { body: { username: 'testuser' }, headers: {}, user:{
      message: 'Invalid credentials', code: 'bad_username'
    } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const credentials = { ttl: 3600, email: 'test@test.com', password: 'password' };
  
    jest.spyOn(utilModule, 'checkUser').mockReturnValue(Promise.resolve({ code: 1, message: 'Invalid credentials' }));
  
    await localController.localLogin(req, res, credentials);
  
    expect(res.status).toBeCalledWith(403);
    expect(res.json).toBeCalledWith({ status: 403, message: 'Invalid credentials' });
  });
  

  it('should create a failed login record when login failed', async () => {
    // we are mocking the auth service validateUser method response
    const req = { body: { username: 'testuser' }, headers: {}, user: {
      username: 'testuser',
      sub: '1',
      _id: 1,
      times: {},

    }};
    mockAuthService.validateUser.mockResolvedValue({
    });
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const credentials = { ttl: 3600, email: 'test@test.com', password: 'wrong-password' };

    jest.spyOn(utilModule, 'checkUser').mockReturnValue({ code: 1, message: 'Some login error'});

    // failedLoginService.create = jest.fn().mockResolvedValue(console.log('failedLoginService.create called'));

    try {
      const result = await localController.localLogin(req, res, credentials);
      expect(failedLoginService.create).toHaveBeenCalled();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.message).toBe('Some login error');
      expect(error.status).toBe(HttpStatus.UNAUTHORIZED);
    }

    // Assuming you have access to failedLoginService and it's correctly instantiated
    expect(failedLoginService.create).toBeCalled();
  });

  it('should return a success message and a jwt token when login is successful', async () => {
    const req = { body: { username: 'testuser' }, headers: {}
    ,user: {
      times: {}
    }
  };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const credentials = { ttl: 3600, email: 'test@test.com', password: 'password' };

    jest.spyOn(utilModule, 'checkUser').mockReturnValue(Promise.resolve({ code: 0, message: 'Login success' }));

    await localController.localLogin(req, res, credentials);

    expect(res.json).toBeCalled();
    expect(res.json.mock.calls[0][0]).toHaveProperty('message', 'Login Success');
    expect(res.json.mock.calls[0][0]).toHaveProperty('jwt');
    expect(res.json.mock.calls[0][0]).toHaveProperty('sub');
  });
});


  

});