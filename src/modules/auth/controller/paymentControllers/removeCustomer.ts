import axios from 'axios';

export default async (id: string) => {
  try {
    // send a request to pyre to create a customer in the api
    const { data } = await axios.post(
      `${process.env.PYRE_API_URL}/customer/${id}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.PYRE_API_KEY,
        },
      }
    );

    return {
      success: true,
      message: 'Customer Removed',
      ...data,
    };
  } catch (err: any) {
    console.error(err);
    return {
      success: false,
      message: 'Error Removing Customer',
    };
  }
};
