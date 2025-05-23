import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import User from '../model/User';
import { encryptData } from '../../../utils/encryption';
import userObject from '../../../utils/userObject';
import { default as errorHandler } from '../../../middleware/error';

/**
 * @description verifies the email of a user and logs them in
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 *
 * @returns {Object} - Returns a response object
 *
 * @author Austin Howard
 * @version 1.0
 * @since 1.0
 *
 */
export default asyncHandler(async (req: Request, res: Response) => {
  try {
    // get the token from the url
    const { verify } = req.query;
    // the verify will be used to find the user in the database, and then we will update the user's emailVerified field to true
    if (!verify) {
      return res.status(400).json({ message: 'No token provided.' });
    }
    // console.log(verify);
    // find the user in the database
    const user = await User.findOne({
      emailVerificationToken: verify,
      emailVerificationExpires: { $gt: Date.now() },
    });
    // if the user is not found, return an error
    if (!user) {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    // console.log(user);
    // if the user is found, update the user's emailVerified field to true
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        isEmailVerified: true,
        // set the emailVerificationToken and emailVerificationExpire fields to null or undefined so that the user can't use the same token again
        emailVerificationToken: undefined,
        emailVerificationExpires: undefined,
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(402).json({
        message: 'Something went wrong updating the users email verification',
      });
    }
    // if the user is successfully updated, send the user a success message
    return res.status(200).json({
      success: true,
      message: 'Email successfully verified.',
      payload: encryptData(await userObject(updatedUser._id).toString()),
    });
  } catch (error) {
    console.log(error);
    errorHandler(error, req, res);
  }
});
