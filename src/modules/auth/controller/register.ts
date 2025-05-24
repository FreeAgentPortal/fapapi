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
import { RoleRegistry } from '../utils/RoleRegistry';
import BillingAccount from '../model/BillingAccount';
import { eventBus } from '../../../lib/eventBus';
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
 * @lastModified - 2025-05-23 14:30:07
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

    let customerCreated = false;
    let billing = null;

    for (const role of roles) {
      const creator = ProfileCreationFactory.getProfileCreator(role);
      if (!creator) continue;

      try {
        const { profileId } = await creator.createProfile(newUser._id.toString());
        profileRefs[role] = profileId;

        const roleMeta = RoleRegistry[role];
        if (roleMeta?.isBillable && !customerCreated) {
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

          customerCreated = true;
          await BillingAccount.create({
            customerId: customerResponse.customerId,
            profileId,
            email: newUser.email,
            profileType: role,
            features: [],
            status: roleMeta.trial ? 'trialing' : 'inactive',
            trialLength: roleMeta.trial ? roleMeta.trialLength : 0,
            processor: 'pyreprocessing'
          });
        }
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
    // now we need to update the users emailVerificationToken and expire
    newUser.emailVerificationToken = await crypto.randomBytes(20).toString('hex');
    newUser.emailVerificationExpires = new Date(Date.now() + 3600000); // 1 hour
    // save the user object
    await newUser.save();
    
    // fire off the event to send the email
    eventBus.publish('user.registered', {
      user: newUser,
    })

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
