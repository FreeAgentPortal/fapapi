import { ObjectId } from "mongoose";
import User, { UserType } from "../../auth/model/User";
import { EmailService } from "../email/EmailService";
import Notification from "../model/Notification";

// modules/notification/handler/userRegisteredHandler.ts
interface UserRegisteredEvent {
  user: UserType;
}

export const handleUserRegistered = async (payload: UserRegisteredEvent) => {
  const { user } = payload;

  // TODO: replace with real implementations
  console.log(`[Notification] New user registered: ${user.email}`);
  
  await EmailService.sendEmail({
    to: user.email,
    subject: 'Welcome to FreeAgentPortal',
    html: `<p>Hi ${user.fullName},</p>
           <p>Thank you for registering on FreeAgentPortal. We are excited to have you on board!</p>
           <p>Best regards,<br/>The FreeAgentPortal Team</p>`,
    from: 'info@fap.com',
  })
  
  // query the admin table to get all admins and populate their emails
  // role is an array of strings, so we need to use $in operator
  const admins = await User.find({ role: { $in: ['admin']}});

  // for each admin, create a notification in the system
  for (const admin of admins){
    await Notification.insertNotification(
      admin._id as any,
      user._id as any, // switch this to a centralized admin user id later
      'Registration Event',
      `New user registered: ${user.email}`,
      `user_registered`,
      user._id as any
    )
  }
};
