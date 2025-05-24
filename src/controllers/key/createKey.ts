import errorHandler from '../../middleware/error';
import { AuthenticatedRequest } from '../../types/AuthenticatedRequest';
import asyncHandler from '../../middleware/asyncHandler';
import { Response } from 'express'; 
import { createHmac, randomBytes } from 'crypto';
import ApiKeySchema from '../../modules/auth/model/ApiKeySchema';

/**
 * @description - Creates a new ticket
 *
 * @returns {object} - A success message and boolean
 *
 * @author Austin Howard
 * @since 1.0.0
 * @version 1.0.0
 * @lastUpdatedBy Austin Howard
 * @lastUpdated 2024-08-14 08:21:29
 */
export default asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Generate a new API key
      const key = generateApiKey();

      // Hash the API key
      const { hash, version } = hashApiKey(
        key,
        process.env.SECRET_KEY_VERSION as any
      );

      const item = await ApiKeySchema.create({
        ...req.body,
        user: req.user._id,
        apiKey: hash,
        // check the request body for the expiresAt, if it doesnt exist, set it to a year from now
        expiresAt:
          req.body?.expiresAt ??
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        version: version,
      });
      if (!item) {
        return res.status(400).json({
          message: 'Failed to create key',
          success: false,
        });
      }

      return res.status(201).json({
        message: 'Successful creation',
        success: true,
        payload: { key },
      });
    } catch (error) {
      console.log(error);
      errorHandler(error, req, res);
    }
  }
);

/**
 * Generates a highly secure API key.
 * @param length The desired length of the API key. Recommended: 32 or 64.
 * @returns A securely generated API key string.
 */
function generateApiKey(length = 64): string {
  // Generate random bytes and convert to a URL-safe base64 string
  return randomBytes(length).toString('base64url'); // base64url encoding is URL-safe and avoids special characters
}

// Function to hash the API key with HMAC
export function hashApiKey(apiKey: any, secretVersion: string | number) {
  // if the secret version is not defined, default to version 1
  if (!secretVersion) {
    secretVersion = 'v1';
  }
  // List of secrets with version numbers
  const secrets = {
    v1: process.env.SECRET_KEY_V1, // Secret key version 1
  };
  const secret = secrets[secretVersion as keyof typeof secrets];
  if (!secret) {
    throw new Error(`Secret key for version ${secretVersion} is not defined`);
  }
  const hmac = createHmac('sha256', secret);
  hmac.update(apiKey);
  return { hash: hmac.digest('hex'), version: secretVersion };
}
