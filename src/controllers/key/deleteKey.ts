import errorHandler from '../../middleware/error';
import { AuthenticatedRequest } from '../../types/AuthenticatedRequest';
import asyncHandler from '../../middleware/asyncHandler';
import { Response } from 'express';
import ApiKeySchema from '../../models/ApiKeySchema';

/**
 * @description - Removes a document from the database
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
      const item = await ApiKeySchema.findById(req.params.id);

      if (!item) {
        return res.status(400).json({
          message: 'Failed to Remove',
          success: false,
        });
      }

      // ensure that the user is the owner or admin
      if (
        item.user.toString() !== req.user._id.toString() ||
        !req.user.role.includes('admin')
      ) {
        return res.status(403).json({
          message: 'You are not authorized to delete this item',
          success: false,
        });
      }

      await ApiKeySchema.findByIdAndDelete(item._id);

      return res.status(201).json({
        message: 'Successful Removal',
        success: true,
      });
    } catch (error) {
      console.log(error);
      errorHandler(error, req, res);
    }
  }
);
