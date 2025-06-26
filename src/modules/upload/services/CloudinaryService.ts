import { Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import User from '../../auth/model/User';
import error from '../../../middleware/error';
import asyncHandler from '../../../middleware/asyncHandler';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { CloudinaryHandler } from '../handlers/CloudinaryHandler';

export class CloudinaryService {
  private handler = new CloudinaryHandler();

  public uploadUserFile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<{ url: string; fileName: string } | void> => {
    try {
      const user = await User.findById(req.user._id).select('accessKey');
      if (!user) throw new Error('User not found');

      //create an array from the files object
      const files = Object.entries(req?.files || {}).map(([key, data]: any, indx) => {
        const typeKey = key.replace('document', 'type');
        return {
          key,
          name: data.name,
          buffer: data.data,
          mimetype: data.mimetype,
          fileType: req.body[typeKey],
        };
      });
      let urls = [];

      // loop over files if multiple files are being uploaded
      for (const file of files) {
        const fileName = file.name || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.txt`;
        if (!file) throw new ErrorUtil('File not found in request', 400);
        if (!Buffer.isBuffer(file.buffer)) {
          throw new ErrorUtil(`Invalid or empty buffer for file ${fileName}`, 400);
        }

        const response = await this.handler.uploadFile(file.buffer, file.name, `users/${user.accessKey}/uploads`);
        urls.push({ url: response.secure_url, fileName: file.name, type: file.fileType });
      }
      console.log(urls);
      res.status(201).json({ payload: urls });
    } catch (err) {
      console.log(err);
      error(err, req, res);
    }
  });
}
