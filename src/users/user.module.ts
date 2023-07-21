import { Module } from '@nestjs/common';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../schema/user.schema';
import { UserController } from './user.controller';
import { RootController } from '../controller/root.controller';
import { LocalController } from 'src/controller/local.controller';
import { UserService } from './user.service';
import { RedisModule } from 'src/redis/redis.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { FailedLoginModule } from 'src/failedLogins/failedLogin.module';
import { GroupModule } from 'src/groups/group.module';
@Module({
  imports: [
    GroupModule,
    RedisModule,
    FailedLoginModule,
    ConfigModule.forRoot(),
    ClientsModule.register([
      { name: 'RABBITMQ_SERVICE', transport: Transport.RMQ },

    ]),
    MongooseModule.forFeature([
      {
        name: 'User',
        schema: UserSchema,
      },
    ]),
  ],
  controllers: [AppController, UserController, RootController, LocalController],
  providers: [AppService, UserService],
  exports: [UserService], // Make sure to export the UserService
})
export class UserModule {}
