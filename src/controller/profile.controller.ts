import { Controller, Get, Patch, UseGuards, Query } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { RolesGuard } from '../auth/roles.guard';
import { SetMetadata } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request, Response } from 'express';
import { Res } from '@nestjs/common';
import { Req } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { positionGroups } from '../auth/constants';
import { User } from '../schema/user.schema';
import { hasScope, decodeJWT } from '../utils/common.utils';
import { RabbitMQ } from '../rabbitmq/rabbitmq.service';

//TODO: should i move it to constants / utils ?
export const safe_fields = [
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
    private queuePublisher: RabbitMQ
  ) {}

  /**
   * @apiGroup Profile
   * @api {get} /profile/list          Query auth profiles (public api)
   * @apiDescription              Query auth profiles
   * @apiName Get auth (public) profiles
   *
   * @apiParam {Object} find      Optional sequelize where query - defaults to {} (can onlu query certain field)
   * @apiParam {Object} order     Optional sequelize sort object - defaults to [['fullname', 'DESC']]
   * @apiParam {Number} limit     Optional Maximum number of records to return - defaults to 100
   * @apiParam {Number} offset    Optional Record offset for pagination
   *
   */
  //TODO - https://github.com/brainlife/auth/blob/c6e6f9e9eea82ab4c8dfd1dac2445aa040879a86/api/controllers/profile.js#L79-L80

  // @UseGuards(JwtAuthGuard)
  @Get('/list')
  async listProfiles(
    @Query('where') whereQuery: string,
    @Query('find') findQuery: string,
    @Query('order') order = 'fullname',
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    let dirty_find = whereQuery ? JSON.parse(whereQuery) : {};
    if (findQuery) dirty_find = JSON.parse(findQuery);

    const find = {};
    // console.log("req.headers.authorization", req.headers.authorization);
    // Bearer ey... -> ey...
    if (req.headers.authorization)
      req.user = decodeJWT(req.headers.authorization.substring(7)) || null;

    let isAdmin = false;
    if (req.user) isAdmin = hasScope(req.user, 'admin');
    for (const k in dirty_find) {
      if (isAdmin || ~safe_fields.indexOf(k)) find[k] = dirty_find[k];
    }

    const select = safe_fields.slice();
    if (isAdmin) {
      select.push('times');
      select.push('profile.private');
    }

    res.json(
      await this.userService.findUsersbyCount(
        find,
        select,
        offset,
        order,
        limit,
      ),
    );
  }

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
    const select = [...safe_fields, 'profile.private'];
    const user = await this.userService.findOnebySub(
      parseInt(req.params.sub),
      select,
    );
    if (!user) {
      throw new HttpException('no such active user', HttpStatus.NOT_FOUND);
    }
    //TODO - why only fullname and not other details ?
    //can i make it more pretty ?
    if (req.body.fullname) user.fullname = req.body.fullname;

    if (req.body.profile) {
      if (!user.profile) {
        user.profile = {
            public: {},
            private: {}
        };
      } else {
        user.profile.public = user.profile.public || {};
        user.profile.private = user.profile.private || {};
      }
    
      if (req.body.profile.public) Object.assign(user.profile.public, req.body.profile.public);
      if (req.body.profile.private) Object.assign(user.profile.private, req.body.profile.private);
      
    }
    await this.userService.updatebySub(user.sub, user);
    this.queuePublisher.publishToQueue('user.update.' + user.sub, req.body);
    return res.json(user);
  }

  /**
   * @apiGroup Profile
   * @api {get} /poscount
   * @description count number of users based of private position
   * @apiName GetPositionCount
   * */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @SetMetadata('roles', 'admin')
  @Get('/poscount')
  async positionCount(@Req() req: Request, @Res() res: Response) {
    const find = { 'profile.private.position': { $exists: true } };
    const users = await this.userService.findbyQuery(find);
    //TODO = can I make it better ?
    const count = {};
    users.forEach((user) => {
      if (!user?.profile?.private?.position) return;
      const pos = user.profile.private.position.toLowerCase();
      if (pos.length <= 1) return;
      let match = null;
      for (const group in positionGroups) {
        if (positionGroups[group].test(pos)) {
          match = group;
          break;
        }
      }
      if (!match) match = 'Other';
      if (!count[match]) count[match] = 0;
      count[match]++;
    });
    return res.json(count);
  }

  /**
   * @apiGroup Profile
   * @api {get} /profile/:sub?    Get user profile
   * @apiDescription              Get user's private profile. Admin can specify optional :sub to retrieve
   *                              other user's private profile
   *
   * @apiHeader {String}          Authorization A valid JWT token "Bearer: xxxxx"
   *
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @SetMetadata('roles', 'admin')
  @Get(':sub?')
  async getProfile(@Req() req: Request, @Res() res: Response) {
    const select = [...safe_fields, 'profile.private'];
    const userParsed = req.user as User; //err if using directly
    let sub = userParsed.sub;
    if (req.params.sub) sub = parseInt(req.params.sub);
    const user = await this.userService.findOnebySub(sub, select);
    if (!user) {
      throw new HttpException('no such active user', HttpStatus.NOT_FOUND);
    }
    return res.json(user);
  }

  /**
   * @apiGroup Profile
   * @api {get} /recreg/:days
   * @description Get user registration count for last :days days
   * @apiName GetRegistrationCount
   **/
  @Get('/recreg/:days')
  async getRecentUsers(@Req() req: Request, @Res() res: Response) {
    const daysInPast = Number(req.params.days); //Number is es6
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysInPast);
    const users = await this.userService.findAll(
      { 'times.register': { $gt: targetDate }, email_confirmed: true },
      safe_fields,
      'times.register',
    );
    return res.json({ users });
  }
}
