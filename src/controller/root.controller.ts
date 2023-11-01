import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  Put,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { UserService } from '../users/user.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import {
  checkUser,
  createClaim,
  sendEmailConfirmation,
  signJWT,
  hasScope,
  intersect_scopes,
  ttl as ttl_config,
  decodeJWT,
} from '../utils/common.utils';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupService } from '../groups/group.service';
import { RolesGuard } from '../auth/roles.guard';
import { RabbitMQ } from '../rabbitmq/rabbitmq.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { response } from 'express';

@Controller('/')
export class RootController {
  constructor(
    private readonly userService: UserService,
    private readonly groupService: GroupService,
    private readonly queuePublisher: RabbitMQ,
  ) {}

  @ApiOperation({ summary: 'Create a new user - signup api' })
  @ApiResponse({
    status: 201,
    description: 'The user has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @ApiBody({
    description: 'User signup details',
    schema: {
      type: 'object',
      required: ['email', 'username', 'password'],
      properties: {
        email: { type: 'string', description: 'User email' },
        username: { type: 'string', description: 'Username' },
        password: { type: 'string', description: 'User password' },
        profile: { type: 'object', description: 'User profile data' },
      },
    },
  })
  @Post('/signup')
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
    let user = await this.userService.findOne({ username });
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

  @ApiOperation({ summary: 'Send email confirmation' })
  @ApiResponse({
    status: 200,
    description: 'Confirmation email sent successfully.',
  })
  @ApiResponse({ status: 500, description: 'Invalid user sub provided.' })
  @ApiResponse({
    status: 500,
    description: 'Internal server error or email confirmation disabled.',
  })
  @Post('/send_email_confirmation')
  @ApiBody({
    description: 'User sub for sending email confirmation',
    schema: {
      type: 'object',
      required: ['sub'],
      properties: {
        sub: { type: 'number', description: 'User sub (subject)' },
      },
    },
  })
  async sendEmailConfirmation(@Body() { sub }) {
    const user = await this.userService.findOnebySub(sub);
    if (!user) {
      throw new HttpException(
        'Invalid user sub',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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

  @ApiOperation({ summary: 'Confirm email using a token' })
  @ApiResponse({
    status: 200,
    description: 'Email address confirmed successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid token provided or email already confirmed.',
  })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @ApiBody({
    description: 'Token for email confirmation',
    schema: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string', description: 'Email confirmation token' },
      },
    },
  })
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

  @ApiOperation({ summary: 'Refresh JWT Token' })
  @ApiBearerAuth()
  @ApiBody({
    description: 'Parameters for JWT token refresh',
    schema: {
      type: 'object',
      properties: {
        scopes: {
          type: 'object',
          description:
            'Desired scopes to intersect (you can remove certain scopes)',
        },
        gids: {
          type: 'array',
          items: { type: 'number' },
          description:
            'Desired gids to intersect (you can remove certain gids)',
        },
        clearProfile: {
          type: 'boolean',
          description: "Set this to true if you don't need profile info",
        },
        ttl: {
          type: 'string',
          description:
            'time-to-live in milliseconds (if not set, it will be defaulted to server default)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'JWT token refreshed successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseGuards(JwtAuthGuard)
  @Post('/refresh')
  async refresh(@Req() req, @Res() res) {
    const user = await this.userService.findOnebySub(req.user.sub);
    if (!user) {
      throw new HttpException(
        "Couldn't find any user with sub:" + req.user.sub,
        HttpStatus.NOT_FOUND,
      );
    }
    if (checkUser(user, req)?.message)
      return res.status(500).json(checkUser(user, req));

    const claim = await createClaim(user, this.userService, this.groupService);

    if (req.body?.scopes)
      claim.scopes = intersect_scopes(claim.scopes, req.body.scopes);
    // console.log(claim.scopes, req.body.scopes);

    // //intersect gids with requested gids
    let total_time_to_live: number;
    if (req.body?.ttl) total_time_to_live = req.body.ttl;
    else total_time_to_live = ttl_config;
    claim.exp = (Date.now() + total_time_to_live) / 1000;

    const jwt = signJWT(claim);
    // console.log("/refresh, claim v/s req.user",claim, req.user);

    this.queuePublisher.publishToQueue(
      'user.refresh.' + user.sub,
      { username: user.username, exp: claim.exp }.toString(),
    );

    //TODO : why aren't we saving these changed to db ?
    return res.json({ jwt });
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

  @ApiOperation({
    summary: 'Get health',
    description: 'Check if server is responding.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ok.',
    type: String,
  })
  @Get('/health')
  async health(@Req() req, @Res() res) {
    return res.send('ok');
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user details',
    description:
      'Returns things that user might want to know about himself. password_hash will be set to true if the password is set, otherwise null.',
  })
  @ApiHeader({
    name: 'authorization',
    description: 'A valid JWT token "Bearer: xxxxx"',
  })
  @ApiResponse({
    status: 200,
    description: 'The user details.',
    type: Object, // or the appropriate DTO
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
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

  @ApiTags('User')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Query list of users' })
  @ApiHeader({
    name: 'authorization',
    description: 'A valid JWT token "Bearer: xxxxx"',
  })
  @ApiQuery({
    name: 'find',
    required: false,
    description: 'Optional sequelize where query',
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Limit the number of results',
    type: Number,
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    description: 'Number of results to skip',
    type: Number,
  })
  @ApiQuery({
    name: 'select',
    required: false,
    description: 'Fields to select',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'List of users.',
    type: [Number], // Assuming the return type is an array of numbers based on the provided example.
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @SetMetadata('roles', 'admin')
  @Get('/users')
  async users(@Req() req, @Res() res) {
    let where = {};
    // console.log(req.query.where, req.query.find);
    if (req.query.find || req.query.where)
      where = JSON.parse(req.query.find || req.query.where);
    console.log('where', where);
    const limit = req.query.limit || 0;
    const skip = req.query.skip || 0;
    const select =
      req.query.select ||
      'sub profile username email_confirmed fullname email ext times scopes active';
    return res.json(
      await this.userService.findUsersbyCount(
        where,
        select,
        skip,
        null, // TODO: is null the right approach for optional sort parameter
        limit,
      ),
    );
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

  @ApiTags('User')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get groups associated with a user by their ID' })
  @ApiParam({ name: 'id', description: 'User ID', type: String }) // to specify path variable
  @ApiHeader({
    name: 'authorization',
    description: 'A valid JWT token (Bearer: xxxxx)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns an array of group IDs associated with the user',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard, RolesGuard)
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
    };
    const groups = await this.groupService.findBy(query, 'id');
    console.log(groups);
    const gids = groups.map((g) => g.id);
    return res.json(gids);
  }

  /**
   * @api {get} /user/:id Get user details
   * used by event service to query for user's email and admin ui to query for user's profile
   *
   * @apiGroup User
   **/
  @ApiTags('User')
  @ApiBearerAuth()
  @SetMetadata('roles', 'admin')
  @Get('/user/:id')
  @ApiOperation({ summary: 'Get details of a specific user by their ID' })
  @ApiParam({ name: 'id', description: 'User ID', type: String }) // to specify path variable
  @ApiResponse({
    status: 200,
    description: 'Returns details of the specified user',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @SetMetadata('roles', 'admin')
  @Get('/user/:id')
  async user(@Req() req, @Res() res) {
    // console.log('getting user', req.params.id);
    //TODO - we should probably use findOnebySub and remove fields ?
    // const user = (
    //   await this.userService.findUsersbyCount(
    //     { sub: req.params.id },
    //     '-password_hash -password_reset_token',
    //     0,
    //     1,
    //   )
    // ).users[0];
    const user = await this.userService.findOnebySub(
      req.params.id,
      '-password_hash -password_reset_token',
    );

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return res.json(user);
  }

  /**
   * @apiName UserGroups
   * @api {get} /jwt/:id  issue user jwt
   * @apiDescription      (admin only)
   * @apiGroup User
   *
   * @apiParam {String[]} [gids] gids to append
   *
   * @apiHeader {String} authorization A valid JWT token "Bearer: xxxxx"
   *
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     [ 1,2,3 ]
   */
  @ApiOperation({ summary: 'Issue user JWT (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiQuery({
    name: 'gids',
    description: 'gids to append',
    type: [String],
    required: false,
  })
  @ApiQuery({
    name: 'claim',
    description: 'Claim for JWT',
    type: String,
    required: false,
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Returns JWT for the specified user',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @SetMetadata('roles', 'admin')
  @Get('/jwt/:id')
  async jwt(@Req() req, @Res() res) {
    const user = await this.userService.findOnebySub(req.params.id);
    if (!user) {
      throw new HttpException(
        "Couldn't find any user with sub:" + req.params.id,
        HttpStatus.NOT_FOUND,
      );
    }
    const error = await checkUser(user, req);
    // console.log('Error from checkUser: ', error); // Log the error here
    if (error) {
      throw new HttpException(error, HttpStatus.FORBIDDEN);
    }
    const claim = await createClaim(user, req, this.groupService);
    if (req.query.claim) Object.assign(claim, JSON.parse(req.query.claim));
    const jwt = signJWT(claim);
    return res.json({ jwt });
  }

  /**
   * @apiName UserGroups
   * @api {put} /user/:id  update user
   * @apiDescription      (admin only)
   * @apiGroup User
   * */
  @ApiTags('User')
  @SetMetadata('roles', 'admin')
  @Put('/user/:id')
  @ApiOperation({ summary: 'Update user details (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiBearerAuth()
  @ApiBody({
    description: 'User details to update',
    type: Object, // You might want to replace 'Object' with a specific DTO or type if you have one
  })
  @ApiResponse({ status: 200, description: 'User Updated Successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @SetMetadata('roles', 'admin')
  @Put('/user/:id')
  async updateUser(@Req() req, @Res() res) {
    const user = await this.userService.findOnebySub(req.params.id);
    if (!user) {
      throw new HttpException(
        "Couldn't find any user with sub:" + req.params.id,
        HttpStatus.NOT_FOUND,
      );
    }
    await this.userService.updatebySub(user.sub, req.body);
    return res.json({ message: 'User Updated Successfully' });
  }

  /**
   * @apiName UserGroups
   * query all groups with basic info
   * @api {get} /groups
   * @apiDescription  access to both admin and users who are member of at least one group
   * returns groups with count for admin and just the group for user who are not auth-admin
   * @apiGroup User
   * */

  @ApiTags('Group')
  @ApiOperation({ summary: 'Query all groups with basic info' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'find',
    required: false,
    description: 'Optional query to filter groups',
    type: 'string',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Limit number of results',
    type: 'number',
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    description: 'Skip number of results',
    type: 'number',
  })
  @ApiResponse({ status: 200, description: 'Successfully retrieved groups' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseGuards(JwtAuthGuard)
  @Get('/groups')
  async groups(@Req() req, @Res() res) {
    const user: any = await this.userService.findOnebySub(req.user.sub);
    if (!user) {
      throw new HttpException(
        "Couldn't find any user with sub:" + req.user.sub,
        HttpStatus.NOT_FOUND,
      );
    }
    let find = {};
    if (req.query.find) find = JSON.parse(req.query.find);
    if (hasScope(req.user, 'admin')) {
      const limit = req.query.limit || 50;
      const skip = req.query.skip || 0;
      const groups = await this.groupService.findGroups(find, +skip, +limit);
      //returns group with count
      return res.json(groups);
    } else {
      const query = {
        $and: [
          //user provided query
          find,

          //normal user only gets to see groups that they are admin/members
          {
            $or: [{ admins: user._id }, { members: user._id }],
          },
        ],
      };
      //TODO - should I remove count ?
      // https://github.com/brainlife/auth/blob/c6e6f9e9eea82ab4c8dfd1dac2445aa040879a86/api/controllers/root.js#L334-L335
      const groups = await this.groupService.findGroups(query, 0, 0);
      return res.json(groups.groups);
    }
  }

  /**
   * @apiName Create new group
   * @api POST /groups
   * @apiDescription  create a new group
   * */
  @ApiTags('Group')
  @ApiOperation({ summary: 'Create a new group' })
  @ApiBearerAuth()
  @ApiBody({
    description: 'Group data',
    type: Object,
    schema: {
      type: 'object',
      required: ['name', 'members', 'admins'], // Specify the required properties here
      properties: {
        name: { type: 'string', description: 'Name of the group' },
        description: {
          type: 'string',
          description: 'Description of the group',
        },
        members: {
          type: 'array',
          items: { type: 'number' },
          description: 'List of member sub IDs',
        },
        admins: {
          type: 'array',
          items: { type: 'number' },
          description: 'List of admin sub IDs',
        },
        // add other properties as required...
      },
      example: {
        name: 'Sample Group',
        description: 'This is a sample group description.',
        members: [1, 2],
        admins: [1],
        // ... other sample values ...
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Group created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseGuards(JwtAuthGuard)
  @Post('/group')
  async createGroup(@Req() req, @Res() res) {
    req.body.members = await this.userService.findbyQuery({
      sub: { $in: req.body.members },
    });
    req.body.admins = await this.userService.findbyQuery({
      sub: { $in: req.body.admins },
    });
    const group = await this.groupService.create(req.body);
    this.queuePublisher.publishToQueue(
      'group.create.' + group.id,
      group.toJSON().toString(),
    );
    res.json({ message: 'Group created', group });
  }

  /**
   * @apiName Update group
   * @api PUT /groups/:id
   * @apiDescription  update a group
   * the user must be an admin of the group or have admin scope
   * */
  @ApiTags('Group')
  @ApiOperation({ summary: 'Update a group' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'group ID', type: String }) // to specify path variable
  @ApiBody({
    description: 'Group update data',
    type: Object,
    schema: {
      type: 'object',
      required: ['name', 'members', 'admins'], // Specify the required properties for updating
      properties: {
        name: { type: 'string', description: 'Name of the group' },
        description: {
          type: 'string',
          description: 'Description of the group',
        },
        members: {
          type: 'array',
          items: { type: 'number' },
          description: 'List of member sub IDs',
        },
        admins: {
          type: 'array',
          items: { type: 'number' },
          description: 'List of admin sub IDs',
        },
        // add other properties as required...
      },
      example: {
        name: 'Updated Sample Group',
        description: 'This is an updated sample group description.',
        members: [2, 3],
        admins: [2],
        // ... other sample values ...
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  @Put('/group/:id')
  async updateGroup(@Req() req, @Res() res) {
    const group = await this.groupService.findOne(req.params.id);
    if (!group) {
      throw new HttpException(
        "Couldn't find any group with id:" + req.params.id,
        HttpStatus.NOT_FOUND,
      );
    }
    const isadmin = group.admins.find(
      (contact: any) => contact.sub == req.user.sub,
    );

    if (!isadmin && !hasScope(req.user, 'admin')) {
      throw new HttpException(
        "You don't have permission to update this group",
        HttpStatus.FORBIDDEN,
      );
    }
    req.body.members = await this.userService.findbyQuery({
      sub: { $in: req.body.members },
    });
    req.body.admins = await this.userService.findbyQuery({
      sub: { $in: req.body.admins },
    });
    const updatedGroup = await this.groupService.update(
      req.params.id,
      req.body,
    );
    // console.log(updatedGroup);
    this.queuePublisher.publishToQueue('group.update.' + group.id, req.body);
    res.json({ message: 'Group updated successfully' });
  }
}
