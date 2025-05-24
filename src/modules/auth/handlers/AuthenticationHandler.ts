import { Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'; 
import User from '../model/User';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';

export class AuthenticationHandler {
  async login(req: Request) {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new Error('Invalid credentials.');
    }

    const isMatch = await user.matchPassword(password.trim());
    if (!isMatch) {
      throw new Error('Invalid credentials.');
    }

    const token = jwt.sign(
      {
        userId: user._id,
        roles: user.role,
        profileRefs: user.profileRefs,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return {
      message: 'Login successful.',
      token,
    };
  }
  async getMe(req: Request & AuthenticatedRequest) {
    const user = req.user; // Assumes middleware has attached it

    if (!user || !user._id) {
      throw new Error("User not authenticated.");
    }

    const foundUser = await User.findById(user._id).select("-password");
    if (!foundUser) {
      throw new Error("User not found.");
    }

    return {
      user: {
        id: foundUser._id,
        email: foundUser.email,
        roles: foundUser.role,
        profileRefs: foundUser.profileRefs
      }
    };
  }
}
