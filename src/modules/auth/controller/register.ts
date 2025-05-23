import { Response, Request } from 'express';
import crypto from 'crypto';
import moment from 'moment';
import mongoose from 'mongoose';
import asyncHandler from '../../../middleware/asyncHandler';
import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';
import User from '../model/User';
import createCustomer from './paymentControllers/createCustomer';
import { ProfileCreationFactory } from '../factory/ProfileCreationFactory';
import { getModelByRole } from '../utils/ModelRegistry';
/**
 * @description: this function registers a new account to the database.
 *               It will check if the email is already in use, if it is, it will throw an error
 *               if the email is not in use, it will create a new user document in the database
 *               and return the user object to the front
 * @param       {object} req: The request object from the client
 * @param       {object} res: The response object from the server
 * @returns     {object} user: The user object we need to return to the front
 * @throws:     If the email is already in use
 * @throws:     If the user is not found
 *
 * @author - Austin Howard
 * @since - 1.0
 * @version 1.0
 * @lastModified - 2023-04-22T18:50:56.000-05:00
 *
 */
export default asyncHandler(async (req: Request, res: Response) => {
  try {
    // first check if the required fields are in the request body
    const { email, password, firstName } = req.body.userInfo;
    const roles = req.body.roles || [];
    if (!email || !password || !firstName) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }
    if (!roles.length) {
      return res.status(400).json({ message: 'Please enter at least one role' });
    }
    const processor = new PaymentProcessorFactory().chooseProcessor('pyreprocessing');
    // check if the email is already in use
    // @ts-ignore
    const userExists = await User.findOne({ email }); // returns a user object if the email is in use
    if (userExists) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    // create a new user object
    const newUser = await User.create({
      ...req.body.userInfo,
    });

    if (!newUser) {
      return res.status(400).json({ message: 'Error creating user' });
    }

    const profileRefs: Record<string, string | null> = {};

    for (const role of roles) {
      const creator = ProfileCreationFactory.getProfileCreator(role);
      if (!creator) continue;

      try {
        const { profileId } = await creator.createProfile(newUser._id.toString());
        profileRefs[role] = profileId;
      } catch (err) {
        console.error(`Error creating ${role} profile:`, err);
        // remove the user if profile creation fails, we also want to ensure we remove any profiles that we created in this loop
        await removeCustomerData(
          [newUser.id, User],
          ...(Object.entries(profileRefs)
            .map(([role, profileId]) => {
              if (!profileId) return null;
              return [profileId, getModelByRole(role)];
            })
            .filter(Boolean) as [string, any][])
        );
        return res.status(400).json({
          message: `Error creating ${role} profile: ${err}`,
        });
      }
    }
 
    // we need to send a request to pyre to create a customer
    const customerResponse = await createCustomer(newUser);

    // if the customerResponse is not successful we need to delete the user, throw an error and return
    if (!customerResponse.success) {
      await removeCustomerData(
        [newUser.id, User],
        ...(Object.entries(profileRefs)
          .map(([role, profileId]) => {
            if (!profileId) return null;
            return [profileId, getModelByRole(role)];
          })
          .filter(Boolean) as [string, any][])
      );
      return res.status(400).json({ message: customerResponse.message });
    }

    // update the user with the customerId from pyre
    newUser.customerId = customerResponse?.payload?._id;

    // create a vault for the user
    const vaultResponse = await processor.createVault(newUser, {
      first_name: newUser.firstName,
      last_name: newUser.lastName,
      email: newUser.email,
      paymentMethod: req.body.billingDetails.paymentMethod,
      address1: req.body.billingDetails.address1,
      address2: req.body.billingDetails.address2,
      city: req.body.billingDetails.city,
      state: req.body.billingDetails.state,
      zip: req.body.billingDetails.zip,
      country: req.body.billingDetails.country,
      // phone: member.phoneNumber,
      creditCardDetails: req.body.billingDetails.creditCardDetails,
      achDetails: req.body.billingDetails.achDetails,
    });

    // if the vaultResponse is not successful we need to delete the user, throw an error and return
    if (!vaultResponse.success) {
      await removeCustomerData(
        [newUser.id, User],
        ...(Object.entries(profileRefs)
          .map(([role, profileId]) => {
            if (!profileId) return null;
            return [profileId, getModelByRole(role)];
          })
          .filter(Boolean) as [string, any][])
      );
      return res.status(400).json({ message: vaultResponse.message });
    }

    // now we need to update the users emailVerificationToken and expire
    newUser.emailVerificationToken = await crypto.randomBytes(20).toString('hex');
    newUser.emailVerificationExpires = new Date(Date.now() + 3600000); // 1 hour
    // save the user object
    await newUser.save();
    // send emails to the user and the admin
    // send email verification
    // set the hostname for the email validation link, if we are in development send it to localhost
    let hostName = 'auth.fap.com';
    if (process.env.NODE_ENV === 'development') {
      hostName = 'localhost:3003';
    }
    // await sendMailSparkPost(
    //   { template_id: 'registration-email' },
    //   [
    //     {
    //       address: { email: newUser.email },
    //       substitution_data: {
    //         name: newUser.fullName,
    //         subject: 'Welcome to the platform',
    //         token: generateToken(newUser._id),
    //       },
    //     },
    //   ],
    //   {}
    // );
    // await sendMailSparkPost(
    //   { template_id: 'verification-email' },
    //   [
    //     {
    //       address: { email: newUser.email },
    //       substitution_data: {
    //         name: newUser.fullName,
    //         host: hostName,
    //         token: newUser.emailVerificationToken,
    //       },
    //     },
    //   ],
    //   {}
    // );

    const admin = await User.findOne({
      role: {
        $in: ['admin', 'superadmin'],
      },
    });
    if (admin) {
      // send email to admin
      // await sendMailSparkPost(
      //   { template_id: 'admin-new-user' },
      //   [
      //     {
      //       address: { email: admin.email },
      //       substitution_data: {
      //         name: admin.fullName,
      //         subject: 'New User Registration',
      //         user: newUser.fullName,
      //       },
      //     },
      //   ],
      //   {}
      // );
    }

    return res.status(201).json({
      message: 'User Created',
      success: true,
    });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: `Something Went Wrong: ${error.message}` });
  }
});

/**
 * @description helper function to remove user data from the database if the customer registration fails
 * @param args - any number of arguments, each argument is an id of a document, and the document that they want to remove from
 * @example removeCustomerData([id1, document1], [id2, document2], [id3, document3])
 * @returns void
 */
const removeCustomerData = async (
  // there can be numerous parameters here
  ...args: [string, mongoose.Model<any>][]
) => {
  try {
    // loop through the arguments
    for (const [id, document] of args) {
      // delete the document from the database
      await document.findByIdAndDelete(id);
    }
  } catch (error: any) {
    // if there is an error, log it
    console.log(error);
    throw new Error('Error Deleting Customer Data');
  }
};
