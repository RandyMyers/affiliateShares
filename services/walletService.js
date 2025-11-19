const MerchantWallet = require('../models/MerchantWallet');
const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/user');
const walletController = require('../controllers/walletController');

/**
 * Check wallet balances and trigger auto-deposits if needed
 */
exports.checkAndTriggerAutoDeposits = async () => {
  try {
    const wallets = await MerchantWallet.find({
      'autoDeposit.enabled': true
    }).populate('merchant', 'email username');

    const results = {
      checked: wallets.length,
      triggered: 0,
      failed: 0,
      errors: []
    };

    for (const wallet of wallets) {
      try {
        // Check if balance is below threshold
        if (wallet.balance.available < wallet.autoDeposit.threshold) {
          console.log(`Auto-deposit triggered for merchant ${wallet.merchant._id}: Balance ${wallet.balance.available} below threshold ${wallet.autoDeposit.threshold}`);

          // Trigger auto-deposit
          // Note: This requires payment gateway integration
          // For now, we'll create a pending transaction that needs manual processing
          // TODO: Integrate with payment gateway to automatically process deposits
          try {
            // Create transaction directly (bypassing controller route handler)
            const balanceBefore = {
              available: wallet.balance.available,
              reserved: wallet.balance.reserved,
              total: wallet.balance.total
            };

            await wallet.addFunds(wallet.autoDeposit.amount);

            const balanceAfter = {
              available: wallet.balance.available,
              reserved: wallet.balance.reserved,
              total: wallet.balance.total
            };

            await WalletTransaction.createTransaction({
              wallet: wallet._id,
              merchant: wallet.merchant._id,
              type: 'auto_deposit',
              amount: wallet.autoDeposit.amount,
              balanceBefore,
              balanceAfter,
              reference: {
                type: 'deposit'
              },
              description: `Auto-deposit: Balance below threshold`,
              paymentGateway: wallet.autoDeposit.paymentMethod,
              status: 'pending', // Will be updated when payment gateway processes it
              metadata: {
                source: 'auto_deposit',
                threshold: wallet.autoDeposit.threshold,
                triggeredAt: new Date()
              }
            });

            results.triggered++;
          } catch (depositError) {
            console.error(`Failed to process auto-deposit for merchant ${wallet.merchant._id}:`, depositError);
            results.failed++;
            results.errors.push({
              merchantId: wallet.merchant._id,
              error: depositError.message
            });
          }

        }
      } catch (error) {
        console.error(`Auto-deposit failed for merchant ${wallet.merchant._id}:`, error);
        results.failed++;
        results.errors.push({
          merchantId: wallet.merchant._id,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error checking auto-deposits:', error);
    throw error;
  }
};

/**
 * Check wallets for low balance and send alerts
 */
exports.checkLowBalanceAlerts = async () => {
  try {
    const wallets = await MerchantWallet.find({
      'settings.alertEnabled': true
    }).populate('merchant', 'email username');

    const alerts = [];

    for (const wallet of wallets) {
      if (wallet.isLowBalance()) {
        alerts.push({
          wallet: wallet._id,
          merchant: wallet.merchant._id,
          merchantEmail: wallet.merchant.email,
          merchantName: wallet.merchant.username,
          balance: wallet.balance.available,
          threshold: wallet.settings.lowBalanceAlert,
          currency: wallet.currency
        });

        // TODO: Send email notification
        // await sendLowBalanceEmail(wallet.merchant.email, {
        //   balance: wallet.balance.available,
        //   threshold: wallet.settings.lowBalanceAlert,
        //   currency: wallet.currency
        // });
      }
    }

    return alerts;
  } catch (error) {
    console.error('Error checking low balance alerts:', error);
    throw error;
  }
};

/**
 * Get wallet summary statistics
 */
exports.getWalletSummary = async (merchantId, startDate, endDate) => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const query = {
      wallet: wallet._id,
      merchant: merchantId,
      status: 'completed'
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await WalletTransaction.find(query);

    const summary = {
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalCommissions: 0,
      totalPayouts: 0,
      totalFees: 0,
      totalRefunds: 0,
      transactionCount: transactions.length,
      byType: {}
    };

    transactions.forEach(transaction => {
      const amount = transaction.amount;

      switch (transaction.type) {
        case 'deposit':
        case 'auto_deposit':
          summary.totalDeposits += amount;
          break;
        case 'commission_payment':
          summary.totalCommissions += amount;
          summary.totalWithdrawals += amount;
          break;
        case 'payout':
          summary.totalPayouts += amount;
          summary.totalWithdrawals += amount;
          break;
        case 'fee':
          summary.totalFees += amount;
          summary.totalWithdrawals += amount;
          break;
        case 'refund':
          summary.totalRefunds += amount;
          summary.totalDeposits += amount;
          break;
      }

      // Count by type
      if (!summary.byType[transaction.type]) {
        summary.byType[transaction.type] = { count: 0, total: 0 };
      }
      summary.byType[transaction.type].count++;
      summary.byType[transaction.type].total += amount;
    });

    return summary;
  } catch (error) {
    console.error('Error getting wallet summary:', error);
    throw error;
  }
};

