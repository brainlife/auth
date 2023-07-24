import { Body, Controller, Get, Post, Req, Res, SetMetadata, UseGuards } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { Inject } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { checkUser, createClaim, hashPassword, sendEmailConfirmation , sendPasswordReset, intersect_scopes, signJWT, queuePublisher } from '../utils/common.utils';
import e, { Response, Request } from 'express';
import { use } from 'passport';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupService } from 'src/groups/group.service';
import { commandOptions } from 'redis';
import { RolesGuard } from 'src/auth/roles.guard';
import { set } from 'mongoose';

@Controller('/')
export class RootController {
  constructor(
    private readonly userService: UserService,
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
    private readonly groupService: GroupService
  ) {}

  @Post('signup')
  async create(@Body() { email, username, password, profile }) {
    //validate email
    if (!email)
      throw new HttpException(
        'Please provide an email address',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    if (!email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/))
      throw new HttpException(
        'Please provide a valid email address',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    //validate username
    if (!username)
      throw new HttpException(
        'Please provide a username',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    //validate password
    if (!password)
      throw new HttpException(
        'Please provide a password',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    //check for existing user
    let user = await this.userService.findByUsername(username);
    if (user)
      throw new HttpException(
        'The username you chose is already registered. If it is yours, please try signing in, or register with a different username.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    user = await this.userService.findByEmail(email);
    if (user)
      throw new HttpException(
        'The email address you chose is already registered. If it is yours, please try signing in, or register with a different email address.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    const response = await this.userService.createUser(
      email,
      username,
      password,
      profile,
    );

    return response;
  }

  @Post('/send_email_confirmation')
  async sendEmailConfirmation(@Body() { sub }) {
    const user = await this.userService.findOnebySub(sub);
    if (user.email_confirmed) {
      throw new HttpException(
        'Email already confirmed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (process.env.EMAIL_ENABLED == 'true') {
      await sendEmailConfirmation(user);
    } else {
      throw new HttpException(
        "referer not set.. can't send confirmation", //'Email confirmation disabled',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      message:
        'Sent confirmation email with subject ' +
        process.env.EMAIL_CONFIRM_SUBJECT,
    };
  }

  @Post('/confirm_email')
  async confirmEmail(@Body() { token }) {
    const user = await this.userService.findOne({ email_confirm_token: token });
    if (!user) {
      throw new HttpException(
        'Invalid token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    console.log(user);
    if (user.email_confirmed == true) {
      throw new HttpException(
        'Email already confirmed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    user.email_confirmed = true;
    user.times.confirm_email = new Date();
    await this.userService.updatebySub(user.sub, user);
    return { message: 'Email address confirmed! Please re-login.' };
  }

  /**
 * @api {post} /refresh Refresh JWT Token.
 * @apiDescription 
 *              JWT Token normally lasts for a few hours. Application should call this API periodically
 *              to get it refreshed before it expires. 
 *              You can also use this API to temporarily drop certain privileges you previously had to 
 *              simulate user with less privileges, or make your token more secure by removing unnecessary
 *              privileges (set scopes parameters)
 *
 * @apiName Refresh
 * @apiGroup User
 *
 * @apiHeader {String} authorization    A valid JWT token (Bearer:)
 * @apiParam {Object} [scopes]    Desired scopes to intersect (you can remove certain scopes)
 * @apiParam {Number[]} [gids]    Desired gids to intersect (you can remove certain gids)
 * @apiParam {Boolean} [clearProfile]
 *                              Set this to true if you don't need profile info 
 * @apiParam {String} [ttl]     time-to-live in milliseconds (if not set, it will be defaulted to server default)
 *
 * @apiSuccess {Object} jwt New JWT token
 */
  @UseGuards(JwtAuthGuard)
  @Post('/refresh')
  async refresh(@Req() req, @Res() res) {
    const user = await this.userService.findOnebySub(req.user.sub);
    if (!user) {
      throw new HttpException("Couldn't find any user with sub:"+req.user.sub, HttpStatus.NOT_FOUND);
    }
    if(checkUser(user,req)?.message) return res.status(500).json(checkUser(user,req)); 
    
    let claim = await createClaim(user,this.userService,this.groupService);
  
    // //TODO improve this part, causing issues with refresh
    // if(req.body.scopes) claim.scopes = intersect_scopes(claim.scopes, req.body.scopes);

    // //intersect gids with requested gids
    // if(req.body.gids) claim.gids = claim.gids.filter(id=>req.body.gids.includes(id));

    // if(req.body.clearProfile) delete claim.profile;

    //TODO Fix TTL
    // if(req.body.ttl) claim.exp = (Date.now() + req.body.ttl)/1000;
    // else claim.exp =  24*3600*1000*7; //time to live
    
    const jwt = signJWT(claim);
    console.log(claim,req.user);
    
    queuePublisher.publishToQueue("user.refresh."+user.sub, 
    {username: user.username, exp: claim.exp}.toString());

    return res.json({jwt});
  }

  /**
 * @api {get} /me Get user details
 * @apiDescription Returns things that user might want to know about himself.
 * password_hash will be set to true if the password is set, otherwise null
 *
 * @apiGroup User
 * 
 * @apiHeader {String} authorization A valid JWT token "Bearer: xxxxx"
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *         "username": "hayashis",
 *         "fullname": "Soichi Hayashi",
 *         "email": "hayashis@iu.edu",
 *         "email_confirmed": true,
 *         "iucas": "hayashis"
 *     }
 */

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async me(@Req() req, @Res() res) {
    const user = await this.userService.findOnebySub(req.user.sub);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    //TODO : Discuss about if we should mark it true or not
    // if(user.password_hash) user.password_hash = true;
    return res.json(user);
  }

  /**
 * @api {get} /users
 * @apiName UserGroups
 * @apiDescription Query list of users
 *
 * @apiGroup User
 *
 * @apiParam {Object} find      Optional sequelize where query - defaults to {}
 * 
 * @apiHeader {String} authorization A valid JWT token "Bearer: xxxxx"
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     [ 1,2,3 ] 
 */


  @UseGuards(JwtAuthGuard,RolesGuard)
  @SetMetadata('roles', 'admin')
  @Get('/users')
  async users(@Req() req, @Res() res) {
    let where = {};
    console.log(req.query.where,req.query.find)
    if(req.query.find||req.query.where) where = JSON.parse(req.query.find||req.query.where);
    const limit = req.query.limit || 50;
    const skip = req.query.skip || 0;
    const select = req.query.select || 'sub profile username email_confirmed fullname email ext times scopes active';
    return res.json(await this.userService.findUsers(where, select, +skip, +limit));  
  }


  /**
 * @api {get} /user/groups/:id Get list of group IDS that user is member/admin of
 * @apiName UserGroups
 * @apiDescription admin only
 *
 * @apiGroup User
 * 
 * @apiHeader {String} authorization A valid JWT token "Bearer: xxxxx"
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     [ 1,2,3 ] 
 */

  @UseGuards(JwtAuthGuard,RolesGuard)
  @SetMetadata('roles', 'admin')
  @Get('/user/groups/:id')
  async userGroups(@Req() req, @Res() res) {
    const user = await this.userService.findOnebySub(req.params.id);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    //TODO why we need 1 here? 
    //https://github.com/brainlife/auth/blob/c6e6f9e9eea82ab4c8dfd1dac2445aa040879a86/api/controllers/root.js#L189
    const query = { 
      $or: [{ admins: user }, { members: user }],
      id: 1,
    };
    const groups = await this.groupService.findBy(query);
    let gids = groups.map(g=>g.id);
    return res.json(gids);
  }


  /**
   * @api {get} /user/:id Get user details
   * used by event service to query for user's email and admin ui to query for user's profile
   * 
   * @apiGroup User
   **/
  @UseGuards(JwtAuthGuard,RolesGuard)
  @SetMetadata('roles', 'admin')
  @Get('/user/:id')
  async user(@Req() req, @Res() res) {
    console.log("getting user",req.params.id);
    //TODO - we should probably use findOnebySub and remove fields ? 
    const user = (await this.userService.findUsers({sub:req.params.id}, '-password_hash -password_reset_token',0,1)).users[0];
    
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return res.json(user);
  }









}
