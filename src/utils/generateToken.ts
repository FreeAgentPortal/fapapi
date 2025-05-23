import jwt, { SignOptions } from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
  roles: string[];
  profileRefs: Record<string, string | null>;
}

/**
 * Returns the JWT secret from environment variables, or throws if not defined.
 */
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables.');
  }
  return secret;
};

/**
 * Generates a signed JWT token from the given payload.
 * 
 * @param payload - The data to encode in the JWT
 * @param options - Optional JWT signing options (e.g. expiration)
 * @returns A signed JWT as a string
 */
export const generateToken = (
  payload: JwtPayload,
  options: SignOptions = { expiresIn: '1h' }
): string => {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, options);
};


export default generateToken;