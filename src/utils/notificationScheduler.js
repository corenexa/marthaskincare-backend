const { checkProductNotifications } = require('./notificationChecker');

let checkInterval = null;

/**
 * Start checking for product notifications periodically
 * @param {number} intervalMinutes - Check interval in minutes (default: 60 minutes)
 */
function startNotificationChecker(intervalMinutes = 60) {
  // Run immediately on startup
  checkProductNotifications().catch((err) => {
    console.error('Error checking product notifications on startup:', err);
  });

  // Then run periodically
  const intervalMs = intervalMinutes * 60 * 1000;
  checkInterval = setInterval(async () => {
    try {
      const count = await checkProductNotifications();
      if (count > 0) {
        console.log(`Notification checker: Created ${count} new notification(s)`);
      }
    } catch (err) {
      console.error('Error checking product notifications:', err);
    }
  }, intervalMs);

  console.log(`Notification checker started: checking every ${intervalMinutes} minutes`);
}

/**
 * Stop the notification checker
 */
function stopNotificationChecker() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('Notification checker stopped');
  }
}

module.exports = {
  startNotificationChecker,
  stopNotificationChecker,
};

