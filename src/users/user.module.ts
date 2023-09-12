import { Module } from '@nestjs/common';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../schema/user.schema';
import { RootController } from '../controller/root.controller';
import { LocalController } from 'src/controller/local.controller';
import { UserService } from './user.service';
import { RedisModule } from 'src/redis/redis.module';
import { FailedLoginModule } from 'src/failedLogins/failedLogin.module';
import { GroupModule } from 'src/groups/group.module';
import { ProfileController } from 'src/controller/profile.controller';
import { RabbitMqModule } from 'src/rabbitmq/rabbitmq.module';
import { GithubController } from 'src/controller/github.controller';
import { GoogleController } from 'src/controller/google.controller';
import { AuthModule } from '../auth/auth.module';
import { OrcidController } from 'src/controller/orcid.controller';
@Module({
  imports: [
    GroupModule,
    RabbitMqModule,
    RedisModule,
    FailedLoginModule,
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      {
        name: 'User',
        schema: UserSchema,
      },
    ]),
  ],
  controllers: [
    AppController,
    RootController,
    LocalController,
    ProfileController,
    GithubController,
    GoogleController,
    OrcidController,
  ],
  providers: [AppService, UserService],
  exports: [UserService], // Make sure to export the UserService
})
export class UserModule {}
