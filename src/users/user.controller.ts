import {Controller, Get, Post, Body, Put, Param, Delete} from '@nestjs/common';
import {UserService} from './user.service';
import {CreateUserDto} from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post()
    create(@Body() createUserDto: CreateUserDto) {
        return this.userService.create(createUserDto);
    }

    @Get()
    findAll() {
        return this.userService.findAll();
    }

    @Get(':sub')
    findOne(@Param('sub') sub: number) {
        return this.userService.findOne(sub);
    }

    @Put(':sub')
    update(@Param('sub') sub: number, @Body() updateUserDto: UpdateUserDto) {
        return this.userService.update(sub, updateUserDto);
    }

    @Delete(':sub')
    remove(@Param('sub') sub: number) {
        return this.userService.remove(sub);
    }

}
