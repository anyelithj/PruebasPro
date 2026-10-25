// [FACADE] módulo raíz que agrupa todos los módulos + wiring transversal global
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';

import { appConfig } from './config/app.config';
import { aiConfig } from './config/ai.config';
import { databaseConfig } from './config/database.config';
import { grpcConfig } from './config/grpc.config';
import { jwtConfig } from './config/jwt.config';

import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

import { CacheModule } from './infrastructure/cache/cache.module';
import { EmailModule } from './infrastructure/email/email.module';
import { PrismaModule } from './infrastructure/database/prisma.module';

import { AppController } from './app.controller';
import { AuthModule } from './module/auth/auth.module';
import { BlockchainModule } from './module/blockchain/blockchain.module';
import { ChatModule } from './module/chat/chat.module';
import { ContactModule } from './module/contact/contact.module';
import { NotificationModule } from './module/notification/notification.module';
import { PostModule } from './module/post/post.module';
import { ProjectModule } from './module/project/project.module';
import { UserModule } from './module/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, databaseConfig, jwtConfig, grpcConfig, aiConfig],
    }),
    PrismaModule,
    CacheModule,
    EmailModule,
    AuthModule,
    UserModule,
    ProjectModule,
    PostModule,
    ContactModule,
    ChatModule,
    NotificationModule,
    BlockchainModule,
  ],
  controllers: [AppController],
  providers: [
    // [GUARD] global: todo protegido salvo @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // [CHAIN-OF-RESPONSIBILITY] interceptors: timeout -> logging -> response envelope
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // [DRY] captura global de errores
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    Reflector,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
