import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../users/user.module';
import { PassportModule } from '@nestjs/passport';
import { UserService } from 'src/users/user.service';
import { RedisService } from 'src/redis/redis.service';
import { RedisModule } from 'src/redis/redis.module';
import { FailedLoginService } from 'src/failedLogins/failedLogin.service';
import { FailedLogin, FailedLoginSchema } from '../schema/failedLogin.schema';

@Module({
    imports: [
        PassportModule,
        RedisModule,
        MongooseModule.forFeature([{ name: FailedLogin.name, schema: FailedLoginSchema }]) // add this
    ],
    
    providers: [FailedLoginService],
    exports: [FailedLoginService],
})
export class FailedLoginModule { }
