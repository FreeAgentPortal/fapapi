import { Request } from "express";
import UserType from "./UserType";

/**
 * @description - This interface will be used to add the user object to the request object.
 *
 * @author Austin Howard
 * @since 1.0
 * @version 1.0.4
 * @lastModified - 2023-06-11T16:21:30.000-05:00
 */
export interface AuthenticatedRequest extends Request {
  user: UserType;
  params: {
    [x: string]: any;
    id?: string;
    slug?: string;
  };
}
