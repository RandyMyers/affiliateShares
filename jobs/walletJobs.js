const walletService = require('../services/walletService');

/**
 * Scheduled job to check and trigger auto-deposits
 * This should be run periodically (e.g., every hour or every 30 minutes)
 */
exports.checkAutoDeposits = async () => {
  try {
    console.log('Running auto-deposit check job...');
    const results = await walletService.checkAndTriggerAutoDeposits();
    console.log('Auto-deposit check completed:', results);
    return results;
  } catch (error) {
    console.error('Error in auto-deposit check job:', error);
    throw error;
  }
};

/**
 * Scheduled job to check low balance alerts
 * This should be run periodically (e.g., every hour)
 */
exports.checkLowBalanceAlerts = async () => {
  try {
    console.log('Running low balance alerts check job...');
    const alerts = await walletService.checkLowBalanceAlerts();
    console.log(`Found ${alerts.length} wallets with low balance`);
    
    // TODO: Send email notifications for low balance alerts
    // for (const alert of alerts) {
    //   await emailService.sendLowBalanceAlert(alert);
    // }
    
    return alerts;
  } catch (error) {
    console.error('Error in low balance alerts check job:', error);
    throw error;
  }
};

/**
 * Run both wallet jobs
 */
exports.runWalletJobs = async () => {
  try {
    await Promise.all([
      exports.checkAutoDeposits(),
      exports.checkLowBalanceAlerts()
    ]);
  } catch (error) {
    console.error('Error running wallet jobs:', error);
    throw error;
  }
};


