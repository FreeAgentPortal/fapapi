import { Response } from 'express';
import asyncHandler from '../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../types/AuthenticatedRequest';
import error from '../../middleware/error';
import ApiKeySchema from '../../models/ApiKeySchema';

/**
 * @description This function returns a single item from the database
 * @param {AuthenticatedRequest} req - The request object
 * @param {Response} res - The response object
 * @param {Function} next - The next middleware function
 * @return {Promise<void>}
 *
 * @author Austin Howard
 * @version 1.0
 * @since 1.0
 * @lastUpdated 2024-08-28 09:29:34
 */
export default asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: any) => {
    try {
      if (!req.params?.id)
        return res
          .status(400)
          .json({ success: false, data: { message: 'No id provided' } });

      const data = await ApiKeySchema.findById(req.params.id);

      if (!data)
        return res
          .status(400)
          .json({ success: false, data: { message: 'No item found' } });

      return res.status(200).json({
        success: true,
        payload: {
          message: 'success',
          data,
        },
      });
    } catch (e: any) {
      console.error(e);
      error(e, req, res);
    }
  }
);
