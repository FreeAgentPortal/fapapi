import User from '../model/User';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { RoleRegistry } from '../utils/RoleRegistry';
import { ProfileCreationFactory } from '../factory/ProfileCreationFactory';
// import { PaymentService } from '../service/PaymentService';
import BillingAccount, { BillingAccountType } from '../model/BillingAccount';
import createCustomer from '../controller/paymentControllers/createCustomer';

type RegisterInput = {
  email: string;
  password: string;
  roles: string[];
  firstName: string;
  lastName?: string;
  [key: string]: any;
};

export class RegisterHandler {
  private user!: any;
  private profileRefs: Record<string, string | null> = {};
  private customerCreated = false;
  private data!: RegisterInput;
  private billingAccount!: BillingAccountType;

  /**
   * @description Initializes the RegisterHandler with user data.
   * @param data - An object containing email, password, and roles of the user.
   */
  constructor() {}

  /**
   * @description Executes the registration process by creating a user and their profiles, and generating a JWT token.
   * @returns {Promise<{token: string, profileRefs: Record<string, string | null>, billing: {status: string, requiresVaultSetup: boolean}}>}
   * @throws {Error} If any step in the registration process fails.
   */
  public async execute(data: RegisterInput): Promise<{
    user: any;
    token: string;
    profileRefs: Record<string, string | null>;
    billing: { status: string; requiresVaultSetup: boolean };
  }> {
    try {
      this.data = data;
      await this.createUser();
      await this.createProfiles();

      const token = jwt.sign(
        {
          userId: this.user._id,
          roles: this.data.roles,
          profileRefs: this.profileRefs,
        },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      return {
        token,
        profileRefs: this.profileRefs,
        billing: {
          status: 'trialing',
          requiresVaultSetup: this.customerCreated,
        },
        user: this.user,
      };
    } catch (error: any) {
      console.log(error);
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * @description Creates a new user in the database. It checks if the email is already registered and hashes the password before saving.
   * @throws {Error} If the email is already registered.
   */
  private async createUser() {
    console.log(`attempting to create user with email: ${this.data.email}`);

    const existingUser = await User.findOne({ email: this.data.email });
    if (existingUser) {
      throw new Error('Email already registered');
    }

    this.user = await User.create({
      ...this.data,
      emailVerificationToken: await crypto.randomBytes(20).toString('hex'),
      emailVerificationExpires: new Date(Date.now() + 3600000), // 1 hour
    });
  }

  /**
   * @description Creates profiles for the user based on their roles. Each role has a specific profile creator that handles the profile creation logic.
   * @throws {Error} If any profile creation fails, it will clean up the user and any created profiles.
   */
  private async createProfiles() {
    console.log(this.data.roles);
    for (const role of this.data.roles) {
      console.log(`Creating profile for role: ${role}`);
      const creator = ProfileCreationFactory.getProfileCreator(role);
      if (!creator) continue;
      console.log(`Using creator for role: ${role}`);
      const profileData = this.data.profileData?.[role] ?? {};
      console.log(`Profile data for role ${role}:`, profileData);
      try {
        const profile = await creator.createProfile(this.user._id, profileData);
        this.profileRefs[role] = profile.profileId;

        const roleMeta = RoleRegistry[role];
        if (roleMeta?.isBillable && !this.customerCreated) {
          console.log(`Creating billing account for role: ${role}`);
          await this.createBillingAccount(profile.profileId, role);
          this.customerCreated = true;
        }
      } catch (err) {
        console.log(`Failed to create profile for role ${role}:`, err);
        await this.cleanupOnFailure();
        throw new Error(`Failed to create ${role} profile`);
      }
    }

    this.user.profileRefs = this.profileRefs;
    await this.user.save();
  }

  /**
   * @description Creates a billing account for the user based on their profile and role. However this does not handle the payment method setup, that is handled in the payment service.
   * @throws {Error} If the billing account creation fails.
   * @param profileId - The ID of the profile for which the billing account is being created.
   * @param role - The role of the user for which the billing account is being created.
   */
  private async createBillingAccount(profileId: string, role: string) {
    console.log(`Creating billing account..`);
    try {
      const customer = await createCustomer(this.user);
      if (!customer.success) throw new Error(customer.message);
      console.log(customer);
      const trialDays = RoleRegistry[role]?.trialLength ?? 14;
      const trialEndsAt = new Date(Date.now() + trialDays * 86400_000); // 86400 seconds in a day
      const status = RoleRegistry[role]?.trial ? 'trialing' : 'inactive';

      this.billingAccount = await BillingAccount.create({
        customerId: customer.payload._id,
        profileId,
        profileType: role,
        email: this.data.email,
        processor: 'pyre',
        processorCustomerId: customer.customer_vault_id,
        status,
        trialLength: trialEndsAt,
        vaulted: false,
      });
      console.log(`Billing account created for profile ${profileId} with role ${role}`);
    } catch (error: any) {
      console.error(
        `Failed to create billing account for profile ${profileId} with role ${role}:`,
        error
      );
      throw new Error(`Failed to create billing account: ${error.message}`);
    }
  }

  /**
   * @description Cleans up the user and their profiles if any step in the registration process fails.
   * This ensures that no partial data is left in the database.
   */
  private async cleanupOnFailure() {
    await Promise.all([
      User.findByIdAndDelete(this.user._id),
      BillingAccount.findByIdAndDelete(this.billingAccount?._id),
      ...Object.entries(this.user.profileRefs)
        .filter(([_, pid]) => !!pid) // filter out any null or undefined profile IDs
        .map(([role, pid]) => mongoose.model(role).findByIdAndDelete(pid)), // delete profiles by role
    ]);
  }

  /**
   * @Description checks if the email is already registered in the system.
   * @param email - The email to check for registration.
   */
  public async isEmailRegistered(email: string): Promise<boolean> {
    const user = await User.findOne({ email }).lean();
    return !!user;
  }

  /**
   * @description Sets verification token and expiration for email verification.
   * @param email - The email to set the verification token for.
   */
  public async setEmailVerificationToken(email: string): Promise<{ token: string }> {
    const user = await User.findOne({ email });
    if (!user) throw new Error('User not found');
    const token = await crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour
    user.emailVerificationToken = token;
    user.emailVerificationExpires = expires;
    await user.save();
    return { token };
  }

  /**
   * @description Verifies the user's email using the provided token.
   * @param token - The verification token sent to the user's email.
   */
  public async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });
    if (!user) throw new Error('Invalid or expired token');
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    return { message: 'Email verified successfully' };
  }
}
