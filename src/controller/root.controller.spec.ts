import { Test, TestingModule } from '@nestjs/testing';
import { RootController } from './root.controller';
import { UserService } from '../users/user.service';
import { HttpException, HttpStatus } from '@nestjs/common';

import { GroupService } from '../groups/group.service';
// Create mock classes for dependencies

class UserServiceMock {
  // Mock necessary methods here based on your UserService implementation
  findOne() {}
  findByEmail() {}
  createUser() {}
}

class GroupServiceMock {}
class ClientProxyMock {}

// Create a mock for RABBITMQ_SERVICE
class RabbitMQServiceMock {}

describe('RootController', () => {
  let rootController: RootController;
  let userService: UserServiceMock;

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
        { provide: 'RABBITMQ_SERVICE', useClass: RabbitMQServiceMock }, // Add the RABBITMQ_SERVICE mock
      ],
    }).compile();

    rootController = module.get<RootController>(RootController);
    userService = module.get<UserServiceMock>(UserService); // Use the mock class type
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
    expect(userService.findOne).toHaveBeenCalledWith(newUser.username);
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
    let user = { ...newUser };
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

  // Add more test cases for other scenarios, such as invalid email, missing username, etc.
});
