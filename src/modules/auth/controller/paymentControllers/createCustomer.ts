import axios from 'axios'; 
import { UserType } from '../../model/User';

export default async (user: UserType) => {
  try {
    // send a request to pyre to create a customer in the api
    const { data } = await axios.post(
      `${process.env.PYRE_API_URL}/customer`,
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phoneNumber,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.PYRE_API_KEY,
        },
      }
    );
 
    return {
      success: true,
      message: 'Customer Created',
      ...data,
    };
  } catch (err: any) {
    console.log(err.response?.data);
    return {
      success: false,
      message: 'Error Creating Customer',
      errors: err.response?.data || err.message || 'Unknown error',
    };
  }
};
