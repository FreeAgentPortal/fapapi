import axios from 'axios';
import { UserType } from '../models/User';

export class PaymentHandler {
  async createVault(
    user: UserType,
    billingDetails: {
      creditCardDetails?: {
        ccnumber?: string;
        ccexp?: string;
        cvv?: string;
      };
      achDetails?: {
        checkname: string;
        checkaba: string;
        checkaccount: string;
        account_holder_type: string;
        account_type: string;
      };
      first_name: string;
      last_name?: string;
      address1?: string;
      address2?: string;
      country?: string;
      state?: string;
      zip?: string;
      city?: string;
      paymentMethod?: string;
    }
  ) {
    try {
      // send a request to pyre to create a customer in the api
      const { data } = await axios.post(
        `${process.env.PYRE_API_URL}/vault/${user.customerId}`,
        {
          ...billingDetails,
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
      console.log(err);
      return {
        success: false,
        message: 'Error Creating Customer',
      };
    }
  }
  async createCustomer(user: UserType) {
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
  }
  async removeCustomer(id: string) {
    try {
      // send a request to pyre to create a customer in the api
      const { data } = await axios.post(`${process.env.PYRE_API_URL}/customer/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.PYRE_API_KEY,
        },
      });

      return {
        success: true,
        message: 'Customer Removed',
        ...data,
      };
    } catch (err: any) {
      console.log(err);
      return {
        success: false,
        message: 'Error Creating Customer',
      };
    }
  }
  async removeCustomerVault(id: string) {
    try {
      // send a request to pyre to create a customer in the api
      const { data } = await axios.post(`${process.env.PYRE_API_URL}/vault/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.PYRE_API_KEY,
        },
      });

      return {
        success: true,
        message: 'Customer Removed',
        ...data,
      };
    } catch (err: any) {
      console.log(err);
      return {
        success: false,
        message: 'Error Creating Customer',
      };
    }
  }
  async fetchCustomer(id: string) {
    try {
      // send a request to pyre to create a customer in the api
      const { data } = await axios.get(`${process.env.PYRE_API_URL}/customer/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.PYRE_API_KEY,
        },
      });
      return {
        success: true,
        ...data,
      };
    } catch (err: any) {
      console.log(err?.response?.data);
      return {
        success: false,
        message: `Error Fetching Customer - ${err?.response?.data?.message}`,
      };
    }
  }
}
