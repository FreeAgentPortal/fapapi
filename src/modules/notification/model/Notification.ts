import mongoose, { Schema, Model, ObjectId } from 'mongoose'; 

export interface NotificationType extends mongoose.Document {
  userTo: ObjectId;
  userFrom: ObjectId;
  message: string;
  description: string;
  notificationType: string;
  opened: boolean;
  entityId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface NotificationAttributes extends NotificationType {
  // Define any additional fields or methods for the document
}

interface NotificationModel extends Model<NotificationAttributes> {
  insertNotification: (
    userTo: mongoose.Types.ObjectId,
    userFrom: mongoose.Types.ObjectId,
    description: string,
    message: string,
    notificationType: string,
    entityId?: mongoose.Types.ObjectId
  ) => Promise<NotificationAttributes>;
}

const NotificationSchema = new Schema<NotificationAttributes>(
  {
    userTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    userFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    message: String,
    description: String,
    notificationType: String,
    opened: {
      type: Boolean,
      default: false,
    },
    entityId: mongoose.Schema.Types.ObjectId,
  },
  {
    timestamps: true,
  }
);

// Define the static method
NotificationSchema.statics.insertNotification = async function (
  userTo,
  userFrom,
  description,
  message,
  notificationType,
  entityId
) {
  const notification = new this({
    userTo,
    userFrom,
    description,
    message,
    notificationType,
    entityId,
  });

  await this.deleteOne({
    userTo,
    userFrom,
    description,
    message,
    notificationType,
    entityId,
  }).catch((err: any) => console.error(err));

  return await notification.save().catch((err: any) => console.error(err));
};

// Add indexes for performance
// Index TTL for automatic removal of old notifications > 60 days old
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 }); // 60 days



// Export the model with proper typing
const Notification = mongoose.model<NotificationAttributes, NotificationModel>(
  'Notification',
  NotificationSchema
);

export default Notification;
