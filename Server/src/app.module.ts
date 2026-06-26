import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ConversationModule } from './conversation/conversation.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI!),
    ConversationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
