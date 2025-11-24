import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { EmailService } from '../email/EmailService';
import { SMSService } from '../sms/SMSService';
import Notification from '../model/Notification';
import User from '../../auth/model/User';

export default class BillingEventHandler {
  /**
   * Handle payment success event
   * Sends notification insert, email, and SMS to user
   */
  paymentSuccess = async (event: any) => {
    console.info(`[Notification] Payment success for receipt: ${event.receiptId}`);

    if (!event.receipt) {
      throw new ErrorUtil('Receipt data is required for payment success event handling', 400);
    }

    try {
      const { receipt } = event;

      // Get user details
      const user = await User.findById(receipt.userId);
      if (!user) {
        console.warn(`[Notification] User ${receipt.userId} not found for payment success notification`);
        return;
      }

      // Send notifications in parallel
      await Promise.all([this.insertPaymentSuccessNotification(user._id, receipt), this.sendPaymentSuccessEmail(user, receipt), this.sendPaymentSuccessSMS(user, receipt)]);

      console.info(`[Notification] Payment success notifications sent for receipt ${receipt.transactionId}`);
    } catch (error) {
      console.error('[Notification] Error sending payment success notifications:', error);
    }
  };

  /**
   * Handle payment failure event
   * Sends notification insert, email, and SMS to user
   */
  paymentFailed = async (event: any) => {
    console.info(`[Notification] Payment failed for receipt: ${event.receiptId}`);

    if (!event.receipt) {
      throw new ErrorUtil('Receipt data is required for payment failure event handling', 400);
    }

    try {
      const { receipt } = event;

      // Get user details
      const user = await User.findById(receipt.userId);
      if (!user) {
        console.warn(`[Notification] User ${receipt.userId} not found for payment failure notification`);
        return;
      }

      // Send notifications in parallel
      await Promise.all([this.insertPaymentFailureNotification(user._id, receipt), this.sendPaymentFailureEmail(user, receipt), this.sendPaymentFailureSMS(user, receipt)]);

      console.info(`[Notification] Payment failure notifications sent for receipt ${receipt.transactionId}`);
    } catch (error) {
      console.error('[Notification] Error sending payment failure notifications:', error);
    }
  };

  /**
   * Insert in-app notification for payment success
   */
  private async insertPaymentSuccessNotification(userId: string, receipt: any): Promise<void> {
    try {
      await Notification.insertNotification(
        userId as any,
        null as any, // No sender for system notifications
        'Payment Successful',
        `Your payment of $${receipt.amount.toFixed(2)} was processed successfully.${receipt.planInfo ? ` Thank you for your ${receipt.planInfo.planName} subscription!` : ''}`,
        'payment',
        receipt._id
      );
      console.info(`[Notification] Payment success in-app notification created for user ${userId}`);
    } catch (error) {
      console.error(`[Notification] Error creating payment success notification for user ${userId}:`, error);
    }
  }

  /**
   * Insert in-app notification for payment failure
   */
  private async insertPaymentFailureNotification(userId: string, receipt: any): Promise<void> {
    try {
      const failureMessage = receipt.failure?.reason
        ? `Your payment of $${receipt.amount.toFixed(2)} failed: ${receipt.failure.reason}. Please update your payment method.`
        : `Your payment of $${receipt.amount.toFixed(2)} failed. Please update your payment method to continue your subscription.`;

      await Notification.insertNotification(
        userId as any,
        null as any, // No sender for system notifications
        'Payment Failed',
        failureMessage,
        'payment',
        receipt._id
      );
      console.info(`[Notification] Payment failure in-app notification created for user ${userId}`);
    } catch (error) {
      console.error(`[Notification] Error creating payment failure notification for user ${userId}:`, error);
    }
  }

  /**
   * Send payment success email
   */
  private async sendPaymentSuccessEmail(user: any, receipt: any): Promise<void> {
    try {
      if (!user.email) {
        console.warn(`[Notification] No email for user ${user._id}`);
        return;
      }

      const transactionDate = new Date(receipt.transactionDate);
      const formattedDate =
        transactionDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }) +
        ' ' +
        transactionDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }) +
        ' ET';

      await EmailService.sendEmail({
        to: user.email,
        subject: 'Payment Confirmation - Free Agent Portal',
        templateId: 'd-576fe7ca1f4c4883b6b9aa04d099d4f3', // TODO: Replace with actual SendGrid template ID
        data: {
          customerName: `${user.firstName} ${user.lastName}`,
          productName: receipt.planInfo?.planName ? `${receipt.planInfo.planName} — ${receipt.planInfo.billingCycle === 'yearly' ? 'Annual' : 'Monthly'}` : 'Payment',
          receiptNumber: receipt.transactionId,
          chargeDate: formattedDate,
          currency: '$',
          amount: receipt.amount.toFixed(2),
          subtotal: receipt.amount.toFixed(2),
          tax: '0.00',
          discount: '0.00',
          pmBrand: receipt.processor?.response?.card?.brand || 'Card',
          pmLast4: receipt.processor?.response?.card?.last4 || '****',
          pmExp:
            receipt.processor?.response?.card?.exp_month && receipt.processor?.response?.card?.exp_year
              ? `${String(receipt.processor.response.card.exp_month).padStart(2, '0')}/${String(receipt.processor.response.card.exp_year).slice(-2)}`
              : 'N/A',
          authCode: receipt.processor?.response?.auth_code || receipt.processor?.transactionId?.slice(-6) || 'N/A',
          lineItems: receipt.planInfo
            ? [
                {
                  name: `${receipt.planInfo.planName} — 1 seat`,
                  quantity: 1,
                  total: receipt.amount.toFixed(2),
                },
              ]
            : [
                {
                  name: receipt.description || 'Payment',
                  quantity: 1,
                  total: receipt.amount.toFixed(2),
                },
              ],
          receiptUrl: `https://athlete.thefreeagentportal.com/billing/receipts/${receipt._id}`,
          updatePaymentUrl: 'https://athlete.thefreeagentportal.com/billing/payment-method',
          supportEmail: 'support@freeagentportal.com',
          logoUrl: 'https://res.cloudinary.com/dsltlng97/image/upload/v1752863629/placeholder-logo_s7jg3y.png',
          orgAddress: '123 Gridiron Ave, Charlotte, NC',
          year: new Date().getFullYear(),
        },
      });

      console.info(`[Notification] Payment success email sent to ${user.email}`);
    } catch (error) {
      console.error(`[Notification] Error sending payment success email to ${user.email}:`, error);
    }
  }

  /**
   * Send payment failure email
   */
  private async sendPaymentFailureEmail(user: any, receipt: any): Promise<void> {
    try {
      if (!user.email) {
        console.warn(`[Notification] No email for user ${user._id}`);
        return;
      }

      const transactionDate = new Date(receipt.transactionDate);
      const formattedDate =
        transactionDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }) +
        ' ' +
        transactionDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }) +
        ' ET';

      await EmailService.sendEmail({
        to: user.email,
        subject: 'Payment Failed - Action Required',
        templateId: 'd-e566f031748145ccbdcd199c100bfdc3', // TODO: Replace with actual SendGrid template ID
        data: {
          customerName: `${user.firstName} ${user.lastName}`,
          productName: receipt.planInfo?.planName ? `${receipt.planInfo.planName} — ${receipt.planInfo.billingCycle === 'yearly' ? 'Annual' : 'Monthly'}` : 'Payment',
          receiptNumber: receipt.transactionId,
          chargeDate: formattedDate,
          currency: '$',
          amount: receipt.amount.toFixed(2),
          subtotal: receipt.amount.toFixed(2),
          tax: '0.00',
          discount: '0.00',
          pmBrand: receipt.processor?.response?.card?.brand || 'Card',
          pmLast4: receipt.processor?.response?.card?.last4 || '****',
          pmExp:
            receipt.processor?.response?.card?.exp_month && receipt.processor?.response?.card?.exp_year
              ? `${String(receipt.processor.response.card.exp_month).padStart(2, '0')}/${String(receipt.processor.response.card.exp_year).slice(-2)}`
              : 'N/A',
          authCode: receipt.processor?.response?.auth_code || receipt.processor?.transactionId?.slice(-6) || 'N/A',
          lineItems: receipt.planInfo
            ? [
                {
                  name: `${receipt.planInfo.planName} — 1 seat`,
                  quantity: 1,
                  total: receipt.amount.toFixed(2),
                },
              ]
            : [
                {
                  name: receipt.description || 'Payment',
                  quantity: 1,
                  total: receipt.amount.toFixed(2),
                },
              ],
          receiptUrl: `https://athlete.thefreeagentportal.com/billing/receipts/${receipt._id}`,
          updatePaymentUrl: 'https://athlete.thefreeagentportal.com',
          supportEmail: 'support@freeagentportal.com',
          logoUrl: 'https://res.cloudinary.com/dsltlng97/image/upload/v1752863629/placeholder-logo_s7jg3y.png',
          orgAddress: 'PO Box 935 Blountville, TN 37617',
          year: new Date().getFullYear(),
          failureCode: receipt.failure?.code || 'UNKNOWN',
          failureMessage: receipt.failure?.reason || 'Payment processing error. Please try again or contact support.',
        },
      });

      console.info(`[Notification] Payment failure email sent to ${user.email}`);
    } catch (error) {
      console.error(`[Notification] Error sending payment failure email to ${user.email}:`, error);
    }
  }

  /**
   * Send payment success SMS
   * Only sends if user has SMS notifications enabled
   */
  private async sendPaymentSuccessSMS(user: any, receipt: any): Promise<void> {
    try {
      // Check if phone number is provided
      if (!user.phoneNumber) {
        console.warn(`[Notification] No phone number for user ${user._id}`);
        return;
      }

      // Check SMS notification preferences
      if (!user.notificationSettings?.accountNotificationSMS) {
        console.info(`[Notification] User ${user._id} has SMS alerts disabled`);
        return;
      }

      const message = `Hi ${user.firstName}, your payment of $${receipt.amount.toFixed(2)} for ${
        receipt.planInfo?.planName || 'your plan'
      } was processed successfully! View receipt at: https://athlete.thefreeagentportal.com/`;

      await SMSService.sendSMS({
        to: user.phoneNumber,
        data: {
          contentSid: 'HX762f1dc9c222adbc92383b2f53bdd222',
          contentVariables: {
            message,
          },
        },
      });

      console.info(`[Notification] Payment success SMS sent to ${user.phoneNumber}`);
    } catch (error) {
      console.error(`[Notification] Error sending payment success SMS to user ${user._id}:`, error);
    }
  }

  /**
   * Send payment failure SMS
   * Only sends if user has SMS notifications enabled
   */
  private async sendPaymentFailureSMS(user: any, receipt: any): Promise<void> {
    try {
      // Check if phone number is provided
      if (!user.phoneNumber) {
        console.warn(`[Notification] No phone number for user ${user._id}`);
        return;
      }

      // Check SMS notification preferences
      if (!user.notificationSettings?.accountNotificationSMS) {
        console.info(`[Notification] User ${user._id} has SMS alerts disabled`);
        return;
      }

      const message = `Hi ${user.firstName}, your payment of $${receipt.amount.toFixed(2)} failed: ${
        receipt.failure?.reason || 'processing error'
      }. Please update your payment method: https://athlete.thefreeagentportal.com/`;

      await SMSService.sendSMS({
        to: user.phoneNumber,
        data: {
          contentSid: 'HX762f1dc9c222adbc92383b2f53bdd222',
          contentVariables: {
            message,
          },
        },
      });

      console.info(`[Notification] Payment failure SMS sent to ${user.phoneNumber}`);
    } catch (error) {
      console.error(`[Notification] Error sending payment failure SMS to user ${user._id}:`, error);
    }
  }
}
