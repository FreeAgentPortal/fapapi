import asyncHandler from '../../middleware/asyncHandler';
import errorHandler from '../../middleware/error';
import UserSchema from '../../models/User';
import crypto from 'crypto';
import sendEmail from '../../utils/sendEmail';
import { Request, Response } from 'express';
import sendMailSparkPost from '../../utils/sendMailSparkPost';
/**
 * @description This function will resend the verification email to the user, with a new token
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @method POST /auth/resend-verification-email
 * @returns {Object} - Returns a response object
 *
 * @author Austin Howard
 * @version 1.0
 * @since 1.0
 *
 */
export default asyncHandler(async (req: Request, res: Response) => {
  try {
    // get the user from the database using the user's email that was sent in the request body
    const user = await UserSchema.findOne({ email: req.body.email });
    // if the user is not found, return an error
    if (!user) {
      return res.status(400).json({ message: 'User not found.' });
    }

    // use the findByIdAndUpdate method to update the user's emailVerificationToken field
    const updatedUser = await UserSchema.findByIdAndUpdate(
      user._id,
      {
        emailVerificationToken: await crypto.randomBytes(20).toString('hex'),
        emailVerificationExpires: Date.now() + 10 * 60 * 1000,
      },
      { new: true }
    );

    // protocol for the reset url
    let protocol = 'https://';
    if (process.env.NODE_ENV === 'development') {
      protocol = 'http://';
    }

    // set the hostname for the email validation link, if we are in development send it to localhost
    let hostName = 'auth.shepherdcms.org';
    if (process.env.NODE_ENV === 'development') {
      hostName = 'localhost:3003';
    }
    await sendMailSparkPost(
      { template_id: 'verification-email' },
      [
        {
          address: { email: updatedUser!.email },
          substitution_data: {
            name: user.fullName,
            protocol: protocol,
            hostname: hostName,
            token: updatedUser!.emailVerificationToken,
          },
        },
      ],
      {}
    );
    // if the user is successfully updated, send the user a success message
    return res.status(200).json({
      success: true,
      message: 'Email successfully sent.',
    });
  } catch (error) {
    console.log(error);
    errorHandler(error, req, res);
  }
});
