import User from '../model/User';
import crypto from 'crypto';

export class PasswordRecoveryHandler {
  async requestReset(email: string): Promise<{ email: string; token: string }> {
    // Validate user exists
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('User with this email does not exist.');
    }
    // Generate token + expiry
    const token = await user.getResetPasswordToken();
    if (!token) {
      throw new Error('Failed to generate reset token.');
    }
    // Save to user
    return {
      email,
      token,
    };
  }

  async verifyToken(token: string): Promise<{ valid: boolean; userId?: string; message?: string }> {
    // hash the token so it can be compared to the hashed token in the database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });
    // Lookup user by token
    if (!user) {
      return {
        valid: false,
        userId: undefined,
        message: 'Invalid or expired reset token.',
      }; // Invalid token
    }
    // Check expiry
    if (user.resetPasswordExpire && user.resetPasswordExpire < new Date()) {
      return {
        valid: false,
        userId: undefined,
        message: 'Token expired.',
      }; // Token expired
    }
    // Return valid/invalid
    return {
      valid: true,
      userId: user._id.toString(),
      message: 'Token is valid.',
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Validate token + expiry
    const isValid = await this.verifyToken(token);
    if (!isValid.valid) {
      throw new Error(isValid.message || 'Invalid token.');
    }
    // Lookup user by token
    const user = await User.findById(isValid.userId);
    if (!user) {
      throw new Error('User not found.');
    }
    // set new password, user schema will handle hashing after save
    user.password = newPassword;
    // Clear reset token and expiry
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    // Save user
    await user.save();
    
    return;
  }
}
