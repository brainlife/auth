import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Message } from '../schema/message';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll() {
    this.client.emit<any>(
      'message_printed',
      new Message('AUTH TS = GETTING ALL USERS'),
    );
    return this.userService.findAll();
  }

  // @Get(':sub')
  // findOne(@Param('sub') sub: number) {
  //   console.log('sub', sub);
  //   return this.userService.findOnebySub(sub);
  // }

  // @Put(':sub')
  // update(@Param('sub') sub: number, @Body() updateUserDto: UpdateUserDto) {
  //   return this.userService.updatebySub(sub, updateUserDto);
  // }

  @Delete(':sub')
  remove(@Param('sub') sub: number) {
    return this.userService.removebySub(sub);
  }
}
