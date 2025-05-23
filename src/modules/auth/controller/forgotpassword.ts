import asyncHandler from '../../middleware/asyncHandler';
import User from '../../models/User';
import UserType from '../../types/UserType';
import { Response, Request } from 'express';
import crypto from 'crypto';
import sendMailSparkPost from '../../utils/sendMailSparkPost';
import { hostname } from 'os';

/**
 * @description: This function sets the necessary fields on the user document to reset the password, and sends an email to the user with a link to reset their password
 * @param       {object} req: The request object from the client
 * @param       {object} res: The response object from the server
 * @returns     {object} user: The user object we need to return to the front
 *
 * @author - Austin Howard
 * @since - 1.0
 * @version 1.0
 * @lastModified - 2023-05-08T08:48:10.000-05:00
 *
 */
export default asyncHandler(async (req: Request, res: Response) => {
  try {
    // find the user by email 
    const users = await User.find({ email: req.body.email });
    const user = users[0];
    // if the user is not found, return an error
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // if the user is found, set the resetPasswordToken and resetPasswordExpire fields on the user document
    //generate a token
    const token = await user.getResetPasswordToken();
    // create the reset url

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
      { template_id: 'reset-password' },
      [
        {
          address: { email: user.email },
          substitution_data: {
            name: user.fullName,
            protocol: protocol,
            hostname: hostName,
            token: token,
          },
        },
      ],
      {}
    );
    // send the email
    // TODO: Implement email sending
    return res.status(200).json({ message: 'Email Sent' });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: `Something Went Wrong: ${error.message}` });
  }
});
