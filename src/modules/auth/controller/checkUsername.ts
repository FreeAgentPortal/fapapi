import { Request, Response } from "express";
import asyncHandler from "../../middleware/asyncHandler";
import User from "../../models/User";
import error from "../../middleware/error";

/**
 * @description Checks if username is available
 * @route POST /api/auth/:username/username
 * @access Public
 * @returns {object} - message
 *
 *
 * @author Austin Howard
 * @since 1.0.0
 * @version 1.0
 * @lastUpdatedBy Austin Howard
 * @lastUpdated 2023-07-22T09:57:11.000-05:00
 */
export default asyncHandler(async (req: Request, res: Response) => {
  try {
    // pull the username from the request params
    const { username } = req.params;
    // username could be undefined, so we check for that
    if (!username) {
      return res.status(400).json({
        message: "Please provide a username",
      });
    }
    // check if the username is available
    const user = await User.findOne({ username });
    // if the username is taken, return an error
    if (user) {
      return res.status(200).json({
        message: "Username is not available",
        exists: true,
      });
    }
    // if the username is available, return a success message
    return res.status(200).json({
      message: "Username is available",
      exists: false,
    });
  } catch (e: any) {
    console.log(e);
    error(e, req, res);
  }
});
