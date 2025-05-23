import asyncHandler from '../../middleware/asyncHandler';
import errorHandler from '../../middleware/error';
import axios from 'axios';

/**
 * @description This function returns a score if the recaptcha is valid and the user is not a bot or spammer
 * @route       GET /api/v1/auth/recaptcha
 * @access      Public
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 *
 * @returns {object} recapcha score
 * @author Austin Howard
 * @since 1.0.0
 * @version 1.0.1
 * @lastUpdated 2024-11-10 19:53:48
 */
export default asyncHandler(async (req: any, res: any, next: any) => {
  try {
    const { token } = req.body; 

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    const url = `https://www.google.com/recaptcha/api/siteverify?secret=6Lfk93oqAAAAAMkAOyt6xsGritehPp_eRmPO44AW&response=${token}`;
    const { data } = await axios.post(url); 

    if (data.success) {
      return res
        .status(200)
        .json({ score: data.score, isVerified: data.score > 0.5 });
    } else {
      return res.status(200).json({
        message: `Recaptcha failed: ${JSON.stringify(data)}`,
        isVerified: false,
      });
    }
  } catch (error) {
    console.log(error);
    errorHandler(error, req, res, next);
  }
});
