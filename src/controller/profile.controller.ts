import { Controller, Patch, UseGuards } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { RedisService } from '../redis/redis.service';
import { GroupService } from '../groups/group.service';
import { RolesGuard } from 'src/auth/roles.guard';
import { SetMetadata } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Request, Response } from 'express';
import { Param } from '@nestjs/common';
import { Res } from '@nestjs/common';
import { Req } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { queuePublisher } from 'src/utils/common.utils';
const safe_fields = [
  'sub',
  'fullname',
  'email',
  'username',
  'active',
  'profile.public' /*, "times.register" - collide with times*/,
];

@Controller('/profile')
export class ProfileController {
  constructor(
    private readonly userService: UserService,
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
    private readonly redisService: RedisService,
    private groupService: GroupService,
  ) {}

  /**
   * @apiGroup Profile
   * @api {put} /profile/:sub?
   *                          Set user profile
   *
   * @apiDescription          Update user's auth profile. :sub? can be set by admin to update user's profile
   *
   * @apiName PutProfile
   *
   * @apiHeader {String}      authorization A valid JWT token (Bearer:)
   *
   * @apiSuccess {Object}     updated user object
   */

  @UseGuards(JwtAuthGuard, RolesGuard)
  @SetMetadata('roles', 'admin')
  @Patch('/:sub?')
  async updateProfile(@Req() req: Request, @Res() res: Response) {
    //TODO - do i really need to add select statement here?
    const user = await this.userService.findOne({ sub: req.params.sub });
    if (!user) {
      throw new HttpException('no such active user', HttpStatus.NOT_FOUND);
    }
    //TODO - why only fullname and not other details ?
    //can i make it more pretty ? 
    if (req.body.fullname) user.fullname = req.body.fullname;

    if (req.body.profile) {
      if (req.body.profile.public){
        if(!user.profile.public) user.profile.public = {};
        Object.assign(user.profile.public, req.body.profile.public);
      }
      if (req.body.profile.private){
        if(!user.profile.private) user.profile.private = {};
        Object.assign(user.profile.private, req.body.profile.private);
      }
    }
    const updatedUser = await this.userService.updatebySub(user.sub, user);
    queuePublisher.publishToQueue('user.update.' + user.sub, req.body);
    return res.json(updatedUser);
  }
}
