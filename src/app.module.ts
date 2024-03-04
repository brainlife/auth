import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './users/user.module';

import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { OrganizationModule } from './organizations/organization.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.dev',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('DB_URL'),
      }),
    }),
    UserModule,
    // ClientsModule.registerAsync([
    //   {
    //     name: 'REDIS_SERVICE',
    //     imports: [ConfigModule],
    //     inject: [ConfigService],
    //     useFactory: async (configService: ConfigService) => ({
    //       transport: Transport.REDIS,
    //       options: {
    //         host: configService.get<string>('REDIS_HOST'),
    //         port: configService.get<number>('REDIS_PORT'),
    //       },
    //     }),
    //   },
    // ]),
    AuthModule,
    RedisModule,
    OrganizationModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
