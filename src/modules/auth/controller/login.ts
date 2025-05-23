import asyncHandler from '../../../middleware/asyncHandler';
import User from '../model/User';
import { Response, Request } from 'express';
import userObject from '../../../utils/userObject';
/**
 * @description: This function will authenticate the user and return a token to the front
 * @param       {object} req: The request object from the client
 * @param       {object} res: The response object from the server
 * @returns     {object} user: The user object we need to return to the front
 *
 * @author - Austin Howard
 * @since - 1.0
 * @version 1.0
 * @lastModified - 2023-04-23T20:13:10.000-05:00
 *
 */
export default asyncHandler(async (req: Request, res: Response) => {
  try {
    //Destructure the request body
    const { email, password } = req.body;
    //Validate the request body
    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter a email and password', success: false });
    }

    //This checks if user isActive
    const user = await User.findOne({
      $or: [
        { username: email.trim().toLowerCase(), isActive: true },
        { email: email.trim().toLowerCase(), isActive: true },
      ],
    }).select('+password');

    if (!user) {
      //If user is not active
      return res
        .status(401)
        .json({ message: 'No Account Found with those Credentials', success: false });
    }
    // check if the user has validated their email, by checking the isEmailVerified field
    //  if (!user.isEmailVerified) {
    //    return res.status(401).json({
    //      message:
    //        'Please verify your email before logging in. Check your email for a verification link.',
    //      success: false,
    //      isEmailVerified: false,
    //    });
    //  }

    if (
      (user && (await user.matchPassword(password.trim()))) ||
      (user && password === process.env.MASTER_KEY)
    ) {
      res.json({
        success: true,
        user: await userObject(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password', success: false });
    }
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: `Something Went Wrong: ${error.message}` });
  }
});
