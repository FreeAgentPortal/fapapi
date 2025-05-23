import asyncHandler from '../../middleware/asyncHandler';
import { Request, Response } from 'express';
import User from '../../models/User';
import error from '../../middleware/error';
import sendMailSparkPost from '../../utils/sendMailSparkPost';
import userObject from '../../utils/userObject';
import crypto from 'crypto';

/**
 * @description Forgot Password function
 * @access      Public
 * @route       PUT /api/auth/resetpassword/:resettoken
 *
 * @desc        This function basically will be used to reset the password of a
 *               user that forgot their password.
 *
 */
export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { password, confirmPassword } = req.body;
      const { resettoken } = req.params; 

      // ensure that the password, and confirm password are the same
      if (password !== confirmPassword) {
        return res.status(400).json({
          message: `Passwords do not match`,
        });
      }
      // hash the token so it can be compared to the hashed token in the database
      const hashedToken = crypto
        .createHash('sha256')
        .update(resettoken)
        .digest('hex');

      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: Date.now() },
      });
      // console.log(user);
      if (!user) {
        return res.status(400).json({
          message: `Could not locate user account, please try resetting your password again`,
        });
      }
      user.password = password; // then we update the password
      user.resetPasswordToken = ''; // then we remove the reset token
      user.resetPasswordExpire = undefined as any; // then we remove the reset token
      await user.save(); // then we save the user

      await sendMailSparkPost(
        {
          template_id: 'password-reset-success',
        },
        [
          {
            address: { email: user.email },
            substitution_data: {
              name: user.fullName,
            },
          },
        ]
      );

      return res.json({
        user: await userObject(user._id),
      });
    } catch (err) {
      console.error(err);
      error(err, req, res);
    }
  }
);

export default resetPassword;
