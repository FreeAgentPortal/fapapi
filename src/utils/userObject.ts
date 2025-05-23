import User from '../modules/auth/model/User'; 
import generateToken from './generateToken';

/**
 *  @description: This function finds a user in the database where we need to return a user object to the front
 *               a central function to keep the code clean and readable
 *  @param       {string} id: The id of the user we need to find
 *  @returns     {object} user: The user object we need to return to the front
 *  @throws:     If the user is not found or if the user is not active
 *
 */
export default async (id: any) => {
  try {
    const user = await User.aggregate([
      {
        $match: {
          _id: id,
        },
      },
      // lookup the member profile created for the user
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'user',
          as: 'member',
          pipeline: [
            {
              $project: {
                _id: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$member',
          preserveNullAndEmptyArrays: true,
        },
      },
      // use the id of the user to find the ministry that the user is a leader of
      {
        // look in the ministries table collection for the first instance where the user is the leader
        $lookup: {
          from: 'ministries',
          localField: 'member._id',
          foreignField: 'leader',
          as: 'ministry',
        },
      },
      {
        $unwind: {
          path: '$ministry',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          member: 1,
          ministry: 1,
          role: 1,
          profileImageUrl: 1,
          username: 1,
          isEmailVerified: 1,
        },
      },
    ]);
    if (!user[0]) {
      throw new Error('User not found');
    }
    return {
      ...user[0],
      token: generateToken(user[0]._id),
    };
  } catch (error: any) {
    console.error(error);
    throw new Error(error);
  }
};
