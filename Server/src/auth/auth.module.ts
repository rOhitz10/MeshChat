import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({
      global: true,
      secret: `"secert123"`,
      signOptions: { expiresIn: '7d' },
    }),
  ],
})
export class AuthModule {}
