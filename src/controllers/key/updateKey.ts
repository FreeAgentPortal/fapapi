import errorHandler from '../../middleware/error';
import { AuthenticatedRequest } from '../../types/AuthenticatedRequest';
import asyncHandler from '../../middleware/asyncHandler';
import { Response } from 'express'; 
import ApiKeySchema from '../../models/ApiKeySchema';

/**
 * @description - Updates a document in the database
 *
 * @returns {object} - A success message and boolean
 *
 * @author Austin Howard
 * @since 1.0.0
 * @version 1.0.0
 * @lastUpdatedBy Austin Howard
 * @lastUpdated 2024-08-28 09:32:22
 */
export default asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const item = await ApiKeySchema.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          runValidators: true,
        }
      );
      if (!item) {
        return res.status(400).json({
          message: 'Failed to update',
          success: false,
        });
      }
      return res.status(201).json({
        message: 'Successful Update',
        success: true,
      });
    } catch (error) {
      console.log(error);
      errorHandler(error, req, res);
    }
  }
);
