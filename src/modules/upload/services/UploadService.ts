import { Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import User from '../../auth/model/User';
import { WasabiHandler } from '../handlers/WasabiHandler';
import error from '../../../middleware/error';
import asyncHandler from '../../../middleware/asyncHandler';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

export class UploadService {
  private wasabi = new WasabiHandler();

  public uploadUserFile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<{ url: string; fileName: string } | void> => {
    try {
      const user = await User.findById(req.user._id).select('accessKey');
      if (!user) throw new Error('User not found');

      const file = req?.files?.file as any;

      const folder = 'files';
      const fileName = file?.name || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.txt`;
      if (!file) throw new ErrorUtil('File not found in request', 400);

      const url = await this.wasabi.uploadFile(user.accessKey, folder, fileName, file.data);
      res.status(201).json({ url, fileName });
    } catch (err) {
      console.log(err);
      error(err, req, res);
    }
  });

  async deleteUserFile(userId: string, fileName: string) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    await this.wasabi.deleteFile(user.accessKey, 'files', fileName);
  }
}
