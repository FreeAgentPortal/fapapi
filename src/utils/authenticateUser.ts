import jwt from "jsonwebtoken";
import User from "../models/User"; // Update this to your actual User model path

interface JwtPayload {
  _id: string;
  iat: number;
  exp: number;
}

/**
 * @description Utility function to verify token and return the authenticated user if valid. If no token or invalid token is provided, returns null.
 * @param authorizationHeader The authorization header from the request
 * @returns The user object if authenticated, otherwise null
 *
 * @author Austin
 * @version 1.0
 * @since 1.0
 * @lastModified 2024-11-26
 */
const authenticateUser = async (authorizationHeader: string | undefined): Promise<any> => {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer")) {
    return null; // No token provided
  }

  try {
    // Extract the token
    const token = authorizationHeader.split(" ")[1];
    
    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    
    // Find the user in the database
    const user = await User.findById(decoded._id).select("-password");
    
    // Ensure user is active
    if (user && user.isActive) {
      return { ...user.toObject() }; // Return user and token
    }
  } catch (error) {
    // Handle invalid token or decoding issues
    return null;
  }

  return null; // If no valid user found
};

export default authenticateUser;
