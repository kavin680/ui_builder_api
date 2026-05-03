import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;

  const mockUserService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getUsers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a user', async () => {
    const createUserDto = {
      email: 'test@example.com',
      userName: 'testuser',
      password: 'password123',
    };
    await controller.create(createUserDto);
    expect(mockUserService.create).toHaveBeenCalledWith(createUserDto);
  });

  it('should get all users', async () => {
    await controller.findAll();
    expect(mockUserService.findAll).toHaveBeenCalled();
  });

  it('should get a user by id', async () => {
    const userId = 1;
    await controller.findOne(userId);
    expect(mockUserService.findOne).toHaveBeenCalledWith(userId);
  });

  it('should update a user', async () => {
    const userId = 1;
    const updateUserDto = { userName: 'updateduser' };
    await controller.update(userId, updateUserDto);
    expect(mockUserService.update).toHaveBeenCalledWith(userId, updateUserDto);
  });

  it('should delete a user', async () => {
    const userId = 1;
    await controller.remove(userId);
    expect(mockUserService.remove).toHaveBeenCalledWith(userId);
  });

  it('should get users via legacy endpoint', async () => {
    await controller.getProfile();
    expect(mockUserService.getUsers).toHaveBeenCalled();
  });
});
