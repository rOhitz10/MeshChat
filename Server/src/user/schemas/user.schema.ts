import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
})
export class User {
  @Prop({
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  })
  name: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({
    required: true,
  })
  password: string;

  @Prop({
    default: '',
  })
  avatar: string;

  @Prop({
    default: '',
    maxlength: 150,
  })
  bio: string;

  @Prop({
    default: false,
  })
  isVerified: boolean;

  @Prop({
    default: false,
  })
  isOnline: boolean;

  @Prop({
    default: null,
  })
  lastSeen: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
