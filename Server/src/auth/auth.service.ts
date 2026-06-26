import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from 'src/user/user.service';
import { RegisterDto } from './dto/register.dto';

type AuthInput = {
  email: string;
  password: string;
};

type SignInData = {
  userId: string;
  username: string;
  userEmail: string;
};

type AuthResult = {
  access_token: string;
  userId: string;
  username: string;
  userEmail: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async authenticate(input: AuthInput): Promise<AuthResult> {
    const user = await this.validateUser(input);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signIn(user);
  }

  async signIn(user: SignInData): Promise<AuthResult> {
    const tokenPayload = {
      sub: user.userId,
      username: user.username,
      email: user.userEmail,
    };

    const accessToken = await this.jwtService.signAsync(tokenPayload);

    return {
      access_token: accessToken,
      userId: user.userId,
      username: user.username,
      userEmail: user.userEmail,
    };
  }

  async validateUser(input: AuthInput): Promise<SignInData | null> {
    const user = await this.userService.findByEmail(input.email);

    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(input.password, user.password);

    if (!isMatch) {
      return null;
    }

    return {
      userId: user._id.toString(),
      username: user.name,
      userEmail: user.email,
    };
  }

  // resgister controller
  async register(dto: RegisterDto) {
    const existingUser = await this.userService.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.userService.create({
      ...dto,
      password: hashedPassword,
    });

    return this.signIn({
      userId: user.id,
      username: user.name,
      userEmail: user.email,
    });
  }
}
