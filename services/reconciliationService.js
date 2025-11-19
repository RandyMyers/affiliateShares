const WalletTransaction = require('../models/WalletTransaction');
const MerchantWallet = require('../models/MerchantWallet');

/**
 * Reconcile wallet transactions with external records
 */
exports.reconcileTransactions = async (merchantId, externalRecords, options = {}) => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const {
      startDate,
      endDate,
      autoMatch = true,
      tolerance = 0.01 // Allow 1 cent difference
    } = options;

    // Get wallet transactions in date range
    const query = {
      merchant: merchantId,
      wallet: wallet._id,
      status: 'completed'
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await WalletTransaction.find(query)
      .sort({ createdAt: 1 })
      .lean();

    const reconciliation = {
      totalTransactions: transactions.length,
      totalExternalRecords: externalRecords.length,
      matched: [],
      unmatched: [],
      discrepancies: [],
      summary: {
        totalMatched: 0,
        totalUnmatched: 0,
        totalDiscrepancies: 0,
        totalMatchedAmount: 0,
        totalUnmatchedAmount: 0,
        totalDiscrepancyAmount: 0
      }
    };

    // Match transactions with external records
    const matchedExternalIds = new Set();

    for (const transaction of transactions) {
      let matched = false;

      for (const externalRecord of externalRecords) {
        if (matchedExternalIds.has(externalRecord.id)) {
          continue; // Already matched
        }

        // Match by amount and date
        const amountMatch = Math.abs(transaction.amount - externalRecord.amount) <= tolerance;
        const dateMatch = this.isDateWithinRange(
          transaction.createdAt,
          externalRecord.date,
          options.dateTolerance || 1 // 1 day tolerance
        );

        if (amountMatch && dateMatch) {
          // Match found
          reconciliation.matched.push({
            transaction: transaction,
            externalRecord: externalRecord,
            matchType: 'amount_and_date'
          });

          matchedExternalIds.add(externalRecord.id);
          matched = true;
          reconciliation.summary.totalMatched++;
          reconciliation.summary.totalMatchedAmount += transaction.amount;

          // Check for discrepancies
          if (Math.abs(transaction.amount - externalRecord.amount) > 0) {
            reconciliation.discrepancies.push({
              transaction: transaction,
              externalRecord: externalRecord,
              difference: transaction.amount - externalRecord.amount,
              type: 'amount'
            });
            reconciliation.summary.totalDiscrepancies++;
            reconciliation.summary.totalDiscrepancyAmount += Math.abs(transaction.amount - externalRecord.amount);
          }

          break;
        }
      }

      if (!matched) {
        reconciliation.unmatched.push({
          transaction: transaction,
          reason: 'No matching external record found'
        });
        reconciliation.summary.totalUnmatched++;
        reconciliation.summary.totalUnmatchedAmount += transaction.amount;
      }
    }

    // Find external records that weren't matched
    for (const externalRecord of externalRecords) {
      if (!matchedExternalIds.has(externalRecord.id)) {
        reconciliation.unmatched.push({
          externalRecord: externalRecord,
          reason: 'No matching transaction found'
        });
      }
    }

    return reconciliation;
  } catch (error) {
    console.error('Error reconciling transactions:', error);
    throw error;
  }
};

/**
 * Check if date is within range
 */
exports.isDateWithinRange = (date1, date2, toleranceDays = 1) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffDays = Math.abs((d1 - d2) / (1000 * 60 * 60 * 24));
  return diffDays <= toleranceDays;
};

/**
 * Generate reconciliation report
 */
exports.generateReconciliationReport = async (merchantId, startDate, endDate) => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const query = {
      merchant: merchantId,
      wallet: wallet._id,
      status: 'completed'
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await WalletTransaction.find(query)
      .sort({ createdAt: 1 })
      .lean();

    const fees = await WalletTransaction.find({
      merchant: merchantId,
      wallet: wallet._id,
      type: 'fee',
      feeStatus: 'charged',
      ...(query.createdAt && { createdAt: query.createdAt })
    }).lean();

    const report = {
      period: {
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      },
      openingBalance: 0,
      closingBalance: wallet.balance.total,
      transactions: {
        deposits: [],
        withdrawals: [],
        fees: [],
        summary: {
          totalDeposits: 0,
          totalWithdrawals: 0,
          totalFees: 0,
          count: transactions.length
        }
      },
      fees: {
        items: fees,
        summary: {
          total: fees.reduce((sum, f) => sum + f.amount, 0),
          byType: {}
        }
      }
    };

    // Calculate opening balance (first transaction balance before)
    if (transactions.length > 0) {
      report.openingBalance = transactions[0].balanceBefore.total;
    }

    // Categorize transactions
    transactions.forEach(transaction => {
      if (transaction.type === 'deposit' || transaction.type === 'auto_deposit' || transaction.type === 'refund') {
        report.transactions.deposits.push(transaction);
        report.transactions.summary.totalDeposits += transaction.amount;
      } else if (transaction.type === 'commission_payment' || transaction.type === 'payout') {
        report.transactions.withdrawals.push(transaction);
        report.transactions.summary.totalWithdrawals += transaction.amount;
      } else if (transaction.type === 'fee') {
        report.transactions.fees.push(transaction);
        report.transactions.summary.totalFees += transaction.amount;
      }
    });

    // Fee summary by type
    fees.forEach(fee => {
      if (!report.fees.summary.byType[fee.feeType]) {
        report.fees.summary.byType[fee.feeType] = {
          count: 0,
          total: 0
        };
      }
      report.fees.summary.byType[fee.feeType].count++;
      report.fees.summary.byType[fee.feeType].total += fee.amount;
    });

    return report;
  } catch (error) {
    console.error('Error generating reconciliation report:', error);
    throw error;
  }
};


