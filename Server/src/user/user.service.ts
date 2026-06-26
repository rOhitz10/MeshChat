import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}
  async findByEmail(email: string): Promise<UserDocument | null> {
    // return users.find((user)=>user.username == username)
    return this.userModel.findOne({ email });
  }
  async create(data: CreateUserDto) {
    return this.userModel.create(data);
  }

//   getProfile() {
//     return {
//       message: 'Get logged-in user profile',
//     };
//   }

  async getUserById(id: string) {
    const user = await this.userModel.findById(id).select('-password');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getProfile(user: any) {
    const userId = user?.userId || user?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const foundUser = await this.userModel.findById(userId).select('-password');

    if (!foundUser) {
      throw new NotFoundException('User not found');
    }

    return foundUser;
  }

  updateProfile(updateUserDto: UpdateUserDto) {
    return {
      message: 'Profile updated successfully',
      data: updateUserDto,
    };
  }
}
