const cron = require('node-cron');
const walletJobs = require('../jobs/walletJobs');

/**
 * Initialize wallet-related scheduled jobs
 */
const initializeWalletScheduler = () => {
  // Run auto-deposit checks every hour (at minute 0)
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Running hourly auto-deposit check...');
    try {
      await walletJobs.checkAutoDeposits();
    } catch (error) {
      console.error('[Scheduler] Error in auto-deposit check:', error);
    }
  });

  // Run low balance alerts check every hour (at minute 15)
  cron.schedule('15 * * * *', async () => {
    console.log('[Scheduler] Running hourly low balance alerts check...');
    try {
      await walletJobs.checkLowBalanceAlerts();
    } catch (error) {
      console.error('[Scheduler] Error in low balance alerts check:', error);
    }
  });

  // Run both jobs daily at 2 AM for comprehensive check
  cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Running daily comprehensive wallet jobs...');
    try {
      await walletJobs.runWalletJobs();
    } catch (error) {
      console.error('[Scheduler] Error in daily wallet jobs:', error);
    }
  });

  console.log('[Scheduler] Wallet scheduler initialized');
  console.log('[Scheduler] - Auto-deposit checks: Every hour at :00');
  console.log('[Scheduler] - Low balance alerts: Every hour at :15');
  console.log('[Scheduler] - Daily comprehensive check: 2:00 AM');
};

module.exports = {
  initializeWalletScheduler
};


