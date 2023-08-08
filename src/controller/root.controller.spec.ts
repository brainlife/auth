import { Test, TestingModule } from '@nestjs/testing';
import { RootController } from './root.controller';
import { UserService } from '../users/user.service';
import { RabbitMQ } from '../rabbitmq/rabbitmq.service';
import { HttpException, HttpStatus } from '@nestjs/common';

import { GroupService } from '../groups/group.service';
import {
  createClaim,
  sendEmailConfirmation,
  signJWT,
} from '../utils/common.utils';

import * as utilModule from '../utils/common.utils';

export class GroupServiceMock {
  findBy = jest.fn();
  findGroups = jest.fn();
  create = jest.fn();
  findOne = jest.fn();
  update = jest.fn();
  findByQuery = jest.fn();
}
export class ClientProxyMock {}

// Create a mock for RABBITMQ_SERVICE
export class RabbitMQServiceMock {
  publishToQueue = jest.fn();
}

export class UserServiceMock {
  findOne = jest.fn();
  findByEmail = jest.fn();
  createUser = jest.fn();
  findOnebySub = jest.fn();
  updatebySub = jest.fn();
  findUsersbyCount = jest.fn();
  findbyQuery = jest.fn();
  findAll = jest.fn();
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

beforeEach(() => {
  jest.clearAllMocks(); // clear all mocks
});

describe('RootController', () => {
  let rootController: RootController;
  let userService: UserServiceMock;
  let res: { json: jest.Mock<any, any>; status: jest.Mock<any, any> }; // Add the 'status' method to the 'res' mock
  let groupService: GroupServiceMock;
  let queuePublisher: RabbitMQServiceMock;

  const newUser = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'testpassword',
    profile: { firstName: 'Test', lastName: 'User' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RootController],
      providers: [
        { provide: UserService, useClass: UserServiceMock },
        { provide: GroupService, useClass: GroupServiceMock },
        { provide: RabbitMQ, useClass: RabbitMQServiceMock }, // Add the RABBITMQ_SERVICE mock
        {
          provide: sendEmailConfirmation,
          useValue: jest.fn().mockResolvedValue(undefined),
        },
        {
          provide: 'createClaim',
          useValue: jest.fn().mockResolvedValue({ sub: 1 }),
        }, // Provide the createClaim mock
        {
          provide: 'signJWT',
          useValue: jest.fn().mockReturnValue('mocked-jwt-token'),
        }, // Provide the signJWT mock
      ],
    })
      .overrideProvider(UserService)
      .useValue(UserServiceMock)
      .compile();

    rootController = module.get<RootController>(RootController);
    userService = module.get<UserServiceMock>(UserService); // Use the mock class type
    groupService = module.get<GroupServiceMock>(GroupService); // Use the mock class type
    queuePublisher = module.get<RabbitMQServiceMock>(RabbitMQ); // Use the mock class type
    // Initialize the 'res' mock
    res = { json: jest.fn(), status: jest.fn(() => res) };
  });

  it('should be defined', () => {
    expect(rootController).toBeDefined();
  });

  it('should create a new user', async () => {
    // Mock the response from the userService.findOne() method
    userService.findOne = jest.fn().mockResolvedValue(null); // Mock that the user does not exist
    // Mock the response from the userService.findByEmail() method
    userService.findByEmail = jest.fn().mockResolvedValue(null); // Mock that the email is not used
    // Mock the response from the userService.createUser() method
    userService.createUser = jest
      .fn()
      .mockResolvedValue({ message: 'User created' });

    // Call the create() method of the RootController with the mock data
    const result = await rootController.create(newUser);

    // Expectations
    expect(userService.findOne).toHaveBeenCalledTimes(1);
    expect(userService.findOne).toHaveBeenCalledWith({
      username: newUser.username,
    });
    expect(userService.findByEmail).toHaveBeenCalledTimes(1);
    expect(userService.findByEmail).toHaveBeenCalledWith(newUser.email);
    expect(userService.createUser).toHaveBeenCalledTimes(1);
    expect(userService.createUser).toHaveBeenCalledWith(
      newUser.email,
      newUser.username,
      newUser.password,
      newUser.profile,
    );
    expect(result).toEqual({ message: 'User created' });
  });

  it('should throw an error if email is missing', async () => {
    const user = { ...newUser }; // Create a shallow copy of newUser object
    delete user.email; // Delete the email property from the User object

    // Mock the response from the userService.findOne() method
    userService.findOne = jest.fn().mockResolvedValue(null); // Mock that the user does not exist
    // Mock the response from the userService.findByEmail() method
    userService.findByEmail = jest.fn().mockResolvedValue(null); // Mock that the email is not used
    // Mock the response from the userService.createUser() method
    userService.createUser = jest
      .fn()
      .mockResolvedValue({ message: 'User created' });

    await expect(rootController.create(user)).rejects.toThrowError(
      new HttpException(
        'Please provide an email address',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
    );

    // Expectations
    expect(userService.findOne).toHaveBeenCalledTimes(0);
    expect(userService.findByEmail).toHaveBeenCalledTimes(0);
    expect(userService.createUser).toHaveBeenCalledTimes(0);
  });

  //   TODO Discuss more about this implementation
  it('should throw an error if username is missing', async () => {
    const user = { ...newUser }; // Create a shallow copy of newUser object
    delete user.username; // Delete the username property from the copied User object

    // Mock the response from the userService.findOne() method
    userService.findOne = jest.fn().mockResolvedValue(null); // Mock that the user does not exist
    // Mock the response from the userService.findByEmail() method
    userService.findByEmail = jest.fn().mockResolvedValue(null); // Mock that the email is not used
    // Mock the response from the userService.createUser() method
    userService.createUser = jest
      .fn()
      .mockResolvedValue({ message: 'User created' });

    await expect(rootController.create(user)).rejects.toEqual(
      new HttpException(
        'Please provide a username',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
    );
  });

  it('should throw an error if password is missing', async () => {
    const user = { ...newUser };
    delete user.password; // Delete the password property from the User object

    // Mock the response from the userService.findOne() method
    userService.findOne = jest.fn().mockResolvedValue(null); // Mock that the user does not exist
    // Mock the response from the userService.findByEmail() method
    userService.findByEmail = jest.fn().mockResolvedValue(null); // Mock that the email is not used
    // Mock the response from the userService.createUser() method
    userService.createUser = jest
      .fn()
      .mockResolvedValue({ message: 'User created' });

    await expect(rootController.create(user)).rejects.toEqual(
      new HttpException(
        'Please provide a password',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
    );
  });

  it('should throw an error if user already exists with same username', async () => {
    const user = { ...newUser };
    user.email = 'testOther@gmail.com'; // Change the email to a different one
    // Mock the response from the userService.findOne() method
    userService.findOne = jest.fn().mockResolvedValue(newUser); // Mock that the user exists
    // Mock the response from the userService.findByEmail() method
    userService.findByEmail = jest.fn().mockResolvedValue(null); // Mock that the email is not used

    // Mock the response from the userService.createUser() method
    userService.createUser = jest
      .fn()
      .mockResolvedValue({ message: 'User created' });

    await expect(rootController.create(user)).rejects.toEqual(
      new HttpException(
        'The username you chose is already registered. If it is yours, please try signing in, or register with a different username.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
    );
  });

  it('should throw an error if user already exists with same email', async () => {
    const user = { ...newUser };
    user.username = 'testOther'; // Change the username to a different one
    // Mock the response from the userService.findOne() method
    userService.findOne = jest.fn().mockResolvedValue(null); // Mock that the user does not exist
    // Mock the response from the userService.findByEmail() method
    userService.findByEmail = jest.fn().mockResolvedValue(newUser); // Mock that the email is used

    // Mock the response from the userService.createUser() method
    userService.createUser = jest
      .fn()
      .mockResolvedValue({ message: 'User created' });

    await expect(rootController.create(user)).rejects.toEqual(
      new HttpException(
        'The email address you chose is already registered. If it is yours, please try signing in, or register with a different email address.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
    );

    // Expectations
    expect(userService.findOne).toHaveBeenCalledTimes(1);
    expect(userService.findOne).toHaveBeenCalledWith({
      username: user.username,
    });
    expect(userService.findByEmail).toHaveBeenCalledTimes(1);
    expect(userService.findByEmail).toHaveBeenCalledWith(user.email);
    expect(userService.createUser).toHaveBeenCalledTimes(0);
  });

  it('/refresh - should not refresh JWT token', async () => {
    // Mock the user data
    const user = {
      sub: 1,
      ...newUser,
    };

    // Mock the response from the userService.findOnebySub() method
    userService.findOnebySub = jest.fn().mockResolvedValue(user);

    const checkUserError = {
      message: 'Account is disabled. Please contact the administrator.',
    };
    const checkUser = jest
      .spyOn(utilModule, 'checkUser')
      .mockReturnValue(checkUserError);

    // Call the refresh() method of the RootController with the mock data
    const response = await rootController.refresh({ user }, res);
    console.log(response);

    // Expectations
    expect(userService.findOnebySub).toHaveBeenCalledTimes(1);
    expect(userService.findOnebySub).toHaveBeenCalledWith(1);

    // Make assertions about the res object using the 'status' and 'json' mocks
    expect(res.status).toHaveBeenCalledTimes(1); // Since the user exists, status should be called
    expect(res.status).not.toHaveBeenCalledWith(HttpStatus.OK); // Assuming HttpStatus.OK for successful request
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).not.toHaveBeenCalledWith({ jwt: 'mocked-jwt-token' });
    expect(res.json).toHaveBeenCalledWith({
      message: 'Account is disabled. Please contact the administrator.',
      // code: 'inactive',
    });
  });

  it('/refresh - hould refresh JWT token', async () => {
    // Mock the user data
    const user = {
      sub: 1,
      ...newUser,
    };

    // Mock the response from the userService.findOnebySub() method
    userService.findOnebySub = jest.fn().mockResolvedValue(user);

    // Update the checkUser mock to resolve to null or undefined
    const checkUserError = {
      message: 'Account is disabled. Please contact the administrator.',
    };
    const checkUser = jest.spyOn(utilModule, 'checkUser').mockReturnValue(null);
    // Call the refresh() method of the RootController with the mock data
    const response = await rootController.refresh({ user: { sub: 1 } }, res);

    // Expectations
    expect(userService.findOnebySub).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ jwt: 'mocked-jwt-token' });
  });

  describe('/GET me', () => {
    it('should return user if user exists', async () => {
      const req = { user: { sub: 1 } };

      // Mock the findOnebySub function to resolve to a user
      userService.findOnebySub = jest.fn().mockResolvedValue(newUser);

      await rootController.me(req, res);

      expect(userService.findOnebySub).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(newUser);
    });

    it('should throw HttpException if user does not exist', async () => {
      const req = { user: { sub: 1 } };

      // Mock the findOnebySub function to resolve to null
      userService.findOnebySub.mockResolvedValue(null);

      await expect(rootController.me(req, res)).rejects.toThrow(HttpException);

      expect(userService.findOnebySub).toHaveBeenCalledWith(1);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('/GET users', () => {
    const defaultWhere = {};
    const defaultLimit = 50;
    const defaultSkip = 0;
    const defaultSelect =
      'sub profile username email_confirmed fullname email ext times scopes active';

    const users = [
      { sub: 1, username: 'testuser', email: 'testuser@test.com' },
      { sub: 2, username: 'testuser-2', email: 'testuser2@test.com' },
    ];

    beforeEach(() => {
      userService.findUsersbyCount = jest
        .fn()
        .mockResolvedValue({ users, count: 2 });
    });

    it('should return users with default parameters if no query parameters are provided', async () => {
      const req = { query: {} };

      await rootController.users(req, res);

      expect(userService.findUsersbyCount).toHaveBeenCalledWith(
        defaultWhere,
        defaultSelect,
        defaultSkip,
        defaultLimit,
      );
      expect(res.json).toHaveBeenCalledWith({ users, count: 2 });
    });

    it('should return users with provided query parameters', async () => {
      const req = {
        query: {
          where: JSON.stringify({ username: 'testuser' }),
          limit: '20',
          skip: '10',
          select: 'sub username',
        },
      };

      await rootController.users(req, res);

      expect(userService.findUsersbyCount).toHaveBeenCalledWith(
        JSON.parse(req.query.where),
        req.query.select,
        Number(req.query.skip),
        Number(req.query.limit),
      );
      expect(res.json).toHaveBeenCalledWith({ users, count: 2 });
    });

    describe('/GET user/groups/:id', () => {
      const user = { id: 'user-id', username: 'testuser' };
      const groups = [{ id: 1 }, { id: 2 }, { id: 3 }];

      it('should throw User not found exception if user does not exist', async () => {
        const req = { params: { id: user.id } };

        userService.findOnebySub = jest.fn().mockResolvedValue(null);

        await expect(rootController.userGroups(req, res)).rejects.toThrow(
          HttpException,
        );
        await expect(rootController.userGroups(req, res)).rejects.toThrow(
          'User not found',
        );
      });

      it('should return group IDs that user is member/admin of', async () => {
        const req = { params: { id: user.id } };

        userService.findOnebySub = jest.fn().mockResolvedValue(user);
        groupService.findBy = jest.fn().mockResolvedValue(groups);

        await rootController.userGroups(req, res);

        const query = {
          $or: [{ admins: user }, { members: user }],
          id: 1,
        };

        expect(groupService.findBy).toHaveBeenCalledWith(query);
        expect(res.json).toHaveBeenCalledWith(groups.map((g) => g.id));
      });
    });

    describe('/GET user/:id', () => {
      const user = {
        id: 'user-id',
        username: 'testuser',
        email: 'testuser@mail.com',
      };

      it('should throw User not found exception if user does not exist', async () => {
        const req = { params: { id: user.id } };

        userService.findOnebySub = jest.fn().mockResolvedValue(null);

        await expect(rootController.user(req, res)).rejects.toThrow(
          HttpException,
        );
        expect(userService.findOnebySub).toHaveBeenCalledWith(
          user.id,
          '-password_hash -password_reset_token',
        );
        expect(res.json).not.toHaveBeenCalled();
        // confirm the error message
        await expect(rootController.user(req, res)).rejects.toThrow(
          'User not found',
        );
      });

      it('should return user details if user exists', async () => {
        const req = { params: { id: user.id } };

        userService.findOnebySub = jest.fn().mockResolvedValue(user);

        await rootController.user(req, res);

        expect(userService.findOnebySub).toHaveBeenCalledWith(
          user.id,
          '-password_hash -password_reset_token',
        );
        expect(res.json).toHaveBeenCalledWith(user);
      });
    });
  });
  describe('/GET jwt/:id', () => {
    const user = {
      id: 'user-id',
      username: 'testuser',
      email: 'testuser@mail.com',
    };
    const claim = { sub: user.id };

    it('should throw User not found exception if user does not exist', async () => {
      const req = { params: { id: user.id } };

      userService.findOnebySub = jest.fn().mockResolvedValue(null);

      await expect(rootController.jwt(req, res)).rejects.toThrow(HttpException);
      expect(userService.findOnebySub).toHaveBeenCalledWith(user.id);
    });

    it('should throw Forbidden exception if checkUser returns an error', async () => {
      const req = { params: { id: user.id } };
      const checkUserError = 'Some error';

      userService.findOnebySub = jest.fn().mockResolvedValue(user);
      // let checkUser = jest.fn().mockResolvedValue(checkUserError);
      const checkUser = jest
        .spyOn(utilModule, 'checkUser')
        .mockResolvedValue(checkUserError);

      await expect(rootController.jwt(req, res)).rejects.toThrow(HttpException);
      expect(checkUser).toHaveBeenCalledWith(user, req);
    });

    it('should return jwt if all checks pass', async () => {
      const req = { params: { id: user.id }, query: {} };
      const jwt = 'jwt-token';

      userService.findOnebySub = jest.fn().mockResolvedValue(user);

      jest.spyOn(utilModule, 'checkUser').mockResolvedValue(null);
      jest.spyOn(utilModule, 'createClaim').mockResolvedValue(claim);
      jest.spyOn(utilModule, 'signJWT').mockReturnValue(jwt);

      // Try-catch block to capture any thrown exceptions and log them
      try {
        await rootController.jwt(req, res);
      } catch (e) {
        console.log(e); // Add this to log the error
      }

      expect(utilModule.createClaim).toHaveBeenCalledWith(
        user,
        req,
        groupService,
      );
      expect(utilModule.signJWT).toHaveBeenCalledWith(claim);
      expect(res.json).toHaveBeenCalledWith({ jwt });
    });
  });

  describe('updateUser', () => {
    it('should update user and return success message', async () => {
      const req = {
        params: { id: 1 },
        body: { username: 'updated-username' },
      };

      const userMock = { sub: 1 };
      userService.findOnebySub = jest.fn().mockResolvedValue(userMock);
      userService.updatebySub = jest.fn().mockResolvedValue(userMock);

      await rootController.updateUser(req, res);

      expect(userService.findOnebySub).toHaveBeenCalledWith(1);
      expect(userService.updatebySub).toHaveBeenCalledWith(1, req.body);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User Updated Successfully',
      });
    });

    it('should throw an exception if user is not found', async () => {
      const req = {
        params: { id: 'non-existent-id' },
        body: { username: 'updated-username' },
      };

      userService.findOnebySub = jest.fn().mockResolvedValue(null);

      await expect(rootController.updateUser(req, res)).rejects.toThrow(
        HttpException,
      );
    });
  });
  describe('groups', () => {
    it('should return groups with count for admin', async () => {
      const req = {
        user: {
          sub: 1,
        },
        query: {
          limit: 2,
          skip: 1,
        },
      };

      const mockUser = { _id: 'userId01' };
      const mockGroups = { count: 2, groups: [{}, {}] };

      userService.findOnebySub.mockResolvedValue(mockUser);
      jest.spyOn(utilModule, 'hasScope').mockReturnValue(true);
      groupService.findGroups.mockResolvedValue(mockGroups);

      await rootController.groups(req, res);

      expect(userService.findOnebySub).toHaveBeenCalledWith(req.user.sub);
      expect(groupService.findGroups).toHaveBeenCalledWith(
        {},
        req.query.skip,
        req.query.limit,
      );
      expect(res.json).toHaveBeenCalledWith(mockGroups);
    });

    //Todo - discuss
    it('should return only group data for non-admin users', async () => {
      const req = {
        user: {
          sub: 2,
        },
        query: {},
      };

      const mockUser = { _id: 'userId02' };
      const mockGroups = { groups: [{}, {}] };

      userService.findOnebySub.mockResolvedValue(mockUser);
      jest.spyOn(utilModule, 'hasScope').mockReturnValue(false);
      groupService.findGroups.mockResolvedValue(mockGroups);

      await rootController.groups(req, res);

      expect(userService.findOnebySub).toHaveBeenCalledWith(req.user.sub);
      expect(groupService.findGroups).toHaveBeenCalledWith(
        {
          $and: [
            {},
            { $or: [{ admins: mockUser._id }, { members: mockUser._id }] },
          ],
        },
        0,
        0,
      );
      expect(res.json).toHaveBeenCalledWith(mockGroups.groups);
    });

    it('should throw an exception if user is not found', async () => {
      const req = {
        user: {
          sub: -11,
        },
        query: {},
      };

      userService.findOnebySub.mockResolvedValue(null);

      await expect(rootController.groups(req, res)).rejects.toThrow(
        HttpException,
      );
    });
  });

  it('should create a new group', async () => {
    // Given
    const members = [1, 2, 3]; // Replace with valid sub values
    const admins = [1, 2, 3]; // Replace with valid sub values
    const groupData = {
      name: 'testGroup',
      members,
      admins,
    };
    const userArray = members.map((sub) => ({ sub, name: `user${sub}` }));
    const createdGroup = {
      id: 'group1',
      name: 'testGroup',
      members: userArray,
      admins: userArray,
    };

    // When userService.findbyQuery is called, return the array of users
    userService.findbyQuery = jest.fn().mockResolvedValue(userArray);

    // When groupService.create is called, return the created group
    groupService.create = jest.fn().mockResolvedValue(createdGroup);

    const req = { body: groupData };
    const res = { json: jest.fn() }; // Mock the res.json function

    // When groupService.create is called, return the created group
    groupService.create = jest.fn().mockResolvedValue({
      ...createdGroup,
      toJSON: () => createdGroup, // Here's where we add the toJSON method
    });

    // Act
    await rootController.createGroup(req, res);

    // Assert
    expect(userService.findbyQuery).toHaveBeenCalledTimes(2);
    expect(userService.findbyQuery).toHaveBeenCalledWith({
      sub: { $in: members },
    });
    expect(userService.findbyQuery).toHaveBeenCalledWith({
      sub: { $in: admins },
    });

    expect(groupService.create).toHaveBeenCalledTimes(1);
    expect(groupService.create).toHaveBeenCalledWith({
      ...groupData,
      members: userArray,
      admins: userArray,
    });

    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Group created',
      group: expect.objectContaining(createdGroup),
    });
  });

  it('should update a group successfully', async () => {
    const group = {
      id: 'group1',
      members: [1, 2, 3],
      admins: [1],
    };
    const user = {
      sub: 1,
      scopes: ['admin'],
    };
    const req = {
      user,
      params: { id: group.id },
      body: { members: [1, 2, 3], admins: [1] },
    };
    const res = { json: jest.fn() };

    groupService.findOne = jest.fn().mockResolvedValue(group);
    userService.findbyQuery = jest.fn().mockResolvedValue([user]);
    groupService.update = jest.fn().mockResolvedValue({
      ...group,
      ...req.body,
    });

    jest.spyOn(utilModule, 'hasScope').mockReturnValue(true);

    await rootController.updateGroup(req, res);

    expect(groupService.findOne).toHaveBeenCalledWith(group.id);
    // expect(await userService.findbyQuery).toHaveBeenCalledWith({ sub: { $in: req.body.members } });
    // expect(await userService.findbyQuery).toHaveBeenCalledWith({ sub: { $in: req.body.admins } });
    expect(groupService.update).toHaveBeenCalledWith(group.id, req.body);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Group updated successfully',
    });
  });

  it('should throw an error if the group does not exist', async () => {
    const user = { sub: 1, scopes: ['admin'] };

    const groupId = 'group1';

    groupService.findOne = jest.fn().mockResolvedValue(null);

    // Mock request and response objects
    const req = {
      user,
      params: { id: groupId },
      body: { members: [1, 2, 3], admins: [1] },
    };
    const res = { json: jest.fn() }; // Mock the res.json function

    // Act and assert
    await expect(rootController.updateGroup(req, res)).rejects.toThrowError(
      `Couldn't find any group with id:${groupId}`,
    );
  });

  it('should throw an error if the user is not an admin and does not have admin scope', async () => {
    // Mock the user data
    const user = { sub: 2, scopes: ['user'] }; // User is not an admin and doesn't have 'admin' scope

    // Mock the group data
    const group = {
      id: 'group1',
      name: 'testGroup',
      admins: [{ sub: 1 }], // User with sub: 1 is the only admin
      members: [{ sub: 1 }, { sub: 2 }],
    };

    jest.spyOn(utilModule, 'hasScope').mockReturnValue(false);

    // Mock the response from the groupService.findOne() method
    groupService.findOne = jest.fn().mockResolvedValue(group);

    // Mock request and response objects
    const req = {
      user,
      params: { id: group.id },
      body: { members: [1, 2, 3], admins: [1] },
    };
    // const res = { json: jest.fn() }; // Mock the res.json function

    // Act and assert
    await expect(rootController.updateGroup(req, res)).rejects.toThrowError(
      "You don't have permission to update this group",
    );
  });
});
