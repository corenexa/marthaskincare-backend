const mongoose = require('mongoose');
const { listProducts } = require('../models/product');
const { createNotification } = require('../models/notification');

// Number of days before expiration to consider as "expiring"
const EXPIRING_DAYS_THRESHOLD = 30;

async function checkProductNotifications() {
  const products = await listProducts();
  let createdCount = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiringThreshold = new Date();
  expiringThreshold.setDate(expiringThreshold.getDate() + EXPIRING_DAYS_THRESHOLD);
  expiringThreshold.setHours(23, 59, 59, 999);

  for (const product of products) {
    // Check for low stock
    if (product.quantity !== null && product.quantity !== undefined && product.quantity < 10) {
      await createNotification({
        type: 'low_stock',
        message: `${product.productName} is low on stock (${product.quantity} remaining)`,
        productId: new mongoose.Types.ObjectId(product.id),
        productName: product.productName,
        metadata: {
          quantity: product.quantity,
        },
      });
      createdCount++;
    }

    // Check for expiring and expired products
    if (product.expiringDate) {
      const expiringDate = new Date(product.expiringDate);
      expiringDate.setHours(0, 0, 0, 0);
      
      const daysUntilExpiry = Math.ceil((expiringDate - today) / (1000 * 60 * 60 * 24));

      // Check if expired
      if (expiringDate < today) {
        await createNotification({
          type: 'expired',
          message: `${product.productName} has expired on ${product.expiringDate.toLocaleDateString()}`,
          productId: new mongoose.Types.ObjectId(product.id),
          productName: product.productName,
          metadata: {
            expiringDate: product.expiringDate,
            daysUntilExpiry: daysUntilExpiry,
          },
        });
        createdCount++;
      }
      // Check if expiring soon (within threshold days and not expired)
      else if (expiringDate <= expiringThreshold && expiringDate >= today) {
        await createNotification({
          type: 'expiring',
          message: `${product.productName} will expire in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} (${product.expiringDate.toLocaleDateString()})`,
          productId: new mongoose.Types.ObjectId(product.id),
          productName: product.productName,
          metadata: {
            expiringDate: product.expiringDate,
            daysUntilExpiry: daysUntilExpiry,
          },
        });
        createdCount++;
      }
    }
  }

  return createdCount;
}

async function checkProductForNotifications(product) {
  // Check a single product for notifications
  if (!product) return 0;

  let createdCount = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiringThreshold = new Date();
  expiringThreshold.setDate(expiringThreshold.getDate() + EXPIRING_DAYS_THRESHOLD);
  expiringThreshold.setHours(23, 59, 59, 999);

  // Check for low stock
  if (product.quantity !== null && product.quantity !== undefined && product.quantity < 10) {
    await createNotification({
      type: 'low_stock',
      message: `${product.productName} is low on stock (${product.quantity} remaining)`,
      productId: new mongoose.Types.ObjectId(product.id),
      productName: product.productName,
      metadata: {
        quantity: product.quantity,
      },
    });
    createdCount++;
  }

  // Check for expiring and expired products
  if (product.expiringDate) {
    const expiringDate = new Date(product.expiringDate);
    expiringDate.setHours(0, 0, 0, 0);
    
    const daysUntilExpiry = Math.ceil((expiringDate - today) / (1000 * 60 * 60 * 24));

    // Check if expired
    if (expiringDate < today) {
      await createNotification({
        type: 'expired',
        message: `${product.productName} has expired on ${product.expiringDate.toLocaleDateString()}`,
        productId: new mongoose.Types.ObjectId(product.id),
        productName: product.productName,
        metadata: {
          expiringDate: product.expiringDate,
          daysUntilExpiry: daysUntilExpiry,
        },
      });
      createdCount++;
    }
    // Check if expiring soon (within threshold days and not expired)
    else if (expiringDate <= expiringThreshold && expiringDate >= today) {
      await createNotification({
        type: 'expiring',
        message: `${product.productName} will expire in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} (${product.expiringDate.toLocaleDateString()})`,
        productId: new mongoose.Types.ObjectId(product.id),
        productName: product.productName,
        metadata: {
          expiringDate: product.expiringDate,
          daysUntilExpiry: daysUntilExpiry,
        },
      });
      createdCount++;
    }
  }

  return createdCount;
}

module.exports = {
  checkProductNotifications,
  checkProductForNotifications,
  EXPIRING_DAYS_THRESHOLD,
};

