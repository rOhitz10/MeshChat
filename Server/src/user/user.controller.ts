import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { Request } from 'express';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '@nestjs/passport';

type AuthenticatedRequest = Request & {
  user?: {
    userId?: string;
    id?: string;
    username?: string;
    name?: string;
  };
};

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @HttpCode(HttpStatus.OK)
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.userService.getProfile(req.user);
  }

  @Get(':id')
  getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  @Patch('me')
  updateProfile(@Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateProfile(updateUserDto);
  }
}
