const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['low_stock', 'expiring', 'expired'],
      required: true,
      index: true,
    },
    message: { type: String, required: true, trim: true },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: { type: String, required: true, trim: true }, // Store for quick access
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    metadata: {
      // Additional info like stock level, expiration date, etc.
      quantity: Number,
      expiringDate: Date,
      daysUntilExpiry: Number,
    },
  },
  { timestamps: true }
);

notificationSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Notification = mongoose.model('Notification', notificationSchema);

async function createNotification({ type, message, productId, productName, metadata = {} }) {
  // Check if similar notification already exists (not read)
  const existing = await Notification.findOne({
    type,
    productId,
    isRead: false,
  }).exec();

  if (existing) {
    // Update existing notification instead of creating duplicate
    const updated = await Notification.findByIdAndUpdate(
      existing._id,
      {
        message,
        productName,
        metadata,
        createdAt: new Date(), // Update timestamp
      },
      { new: true }
    ).exec();
    return updated ? updated.toJSON() : null;
  }

  const doc = await Notification.create({
    type,
    message,
    productId,
    productName,
    metadata,
  });
  return doc.toJSON();
}

async function listNotifications({ isRead, limit = 100 } = {}) {
  const query = {};
  if (typeof isRead === 'boolean') {
    query.isRead = isRead;
  }

  const docs = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
  return docs.map((d) => d.toJSON());
}

async function getUnreadCount() {
  return Notification.countDocuments({ isRead: false }).exec();
}

async function markAsRead(notificationId) {
  const doc = await Notification.findByIdAndUpdate(
    notificationId,
    {
      isRead: true,
      readAt: new Date(),
    },
    { new: true }
  ).exec();
  return doc ? doc.toJSON() : null;
}

async function markAllAsRead() {
  const result = await Notification.updateMany(
    { isRead: false },
    {
      isRead: true,
      readAt: new Date(),
    }
  ).exec();
  return result.modifiedCount;
}

async function deleteNotification(notificationId) {
  return Notification.findByIdAndDelete(notificationId).exec();
}

async function deleteOldReadNotifications(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await Notification.deleteMany({
    isRead: true,
    readAt: { $lt: cutoffDate },
  }).exec();
  return result.deletedCount;
}

module.exports = {
  Notification,
  createNotification,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteOldReadNotifications,
};

