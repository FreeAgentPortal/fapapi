import SparkPost from 'sparkpost';

export default async (
  content: {
    template_id?: string;
    subject?: string;
  },
  recipients: Array<{
    address: { email: string };
    substitution_data?: { [key: string]: string };
  }>,
  options?: {
    open_tracking?: boolean;
    click_tracking?: boolean;
    transactional?: boolean;
    sandbox?: boolean;
    start_time?: string;
  }
) => {
  try {
    const client = new SparkPost(process.env.SPARKPOST_API_KEY);
    
    const response = await client.transmissions.send({
      content,
      recipients,
      options,
    });
    
    // console.log(response);
    return response;
  } catch (error) {
    console.error(error);
    throw new Error('Error sending email');
  }
};
