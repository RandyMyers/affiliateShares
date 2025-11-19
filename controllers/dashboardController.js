const mongoose = require('mongoose');
const Store = require('../models/store');
const Order = require('../models/order');
const Commission = require('../models/commission');
const Affiliate = require('../models/affiliate');
const Click = require('../models/click');
const { sendResponse } = require('../utils/response');

// Get dashboard overview statistics
exports.getDashboardOverview = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { dateRange = '30' } = req.query; // 'today', '7', '30', '90', 'ytd', 'custom'
    const { startDate, endDate } = req.query;

    // Get all merchant stores
    const merchantStores = await Store.find({ merchant: merchantId }).select('_id');
    const storeIds = merchantStores.map(s => s._id);

    if (storeIds.length === 0) {
      return sendResponse(res, 200, 'Dashboard overview retrieved successfully', {
        today: getEmptyStats('Today'),
        thisMonth: getEmptyStats('This Month'),
        yearToDate: getEmptyStats('Year to Date'),
        recentOrders: [],
        recentActivity: [],
        topAffiliates: [],
        charts: {
          revenueTrend: [],
          clicksConversions: []
        },
        alerts: []
      });
    }

    // Calculate date ranges
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = new Date(today);
    today.setHours(23, 59, 59, 999);
    const todayEnd = new Date(today);
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Today's stats
    const todayStats = await getPeriodStats(storeIds, todayStart, todayEnd);

    // This month's stats
    const monthStats = await getPeriodStats(storeIds, monthStart, now);

    // Year to date stats
    const ytdStats = await getPeriodStats(storeIds, yearStart, now);

    // Recent orders (last 10)
    const recentOrders = await Order.find({
      store: { $in: storeIds }
    })
      .populate('store', 'name')
      .populate('affiliate', 'user')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('orderId totalAmount commissionAmount status createdAt store affiliate');

    // Recent activity (affiliate applications, approvals, etc.)
    const recentActivity = await getRecentActivity(storeIds);

    // Top performing affiliates (last 30 days)
    const topAffiliates = await getTopAffiliates(storeIds, 30);

    // Chart data
    const revenueTrend = await getRevenueTrend(storeIds, dateRange, startDate, endDate);
    const clicksConversions = await getClicksConversionsTrend(storeIds, dateRange, startDate, endDate);

    // Alerts and notifications
    const alerts = await getAlerts(merchantId, storeIds);

    return sendResponse(res, 200, 'Dashboard overview retrieved successfully', {
      today: {
        ...todayStats,
        period: 'Today',
        dateRange: { start: todayStart, end: todayEnd }
      },
      thisMonth: {
        ...monthStats,
        period: 'This Month',
        dateRange: { start: monthStart, end: now }
      },
      yearToDate: {
        ...ytdStats,
        period: 'Year to Date',
        dateRange: { start: yearStart, end: now }
      },
      recentOrders: recentOrders.map(order => ({
        _id: order._id,
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        commissionAmount: order.commissionAmount,
        status: order.status,
        createdAt: order.createdAt,
        store: order.store?.name || 'N/A',
        affiliate: order.affiliate?.user?.username || 'N/A'
      })),
      recentActivity,
      topAffiliates,
      charts: {
        revenueTrend,
        clicksConversions
      },
      alerts
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to get stats for a period
async function getPeriodStats(storeIds, startDate, endDate) {
  const [orders, commissions, clicks] = await Promise.all([
    Order.find({
      store: { $in: storeIds },
      createdAt: { $gte: startDate, $lte: endDate }
    }),
    Commission.find({
      store: { $in: storeIds },
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['approved', 'paid'] }
    }),
    Click.find({
      store: { $in: storeIds },
      createdAt: { $gte: startDate, $lte: endDate }
    })
  ]);

  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const totalCommissions = commissions.reduce((sum, comm) => sum + (comm.amount || 0), 0);
  const totalClicks = clicks.length;
  const totalOrders = orders.length;
  const conversionRate = totalClicks > 0 ? ((totalOrders / totalClicks) * 100).toFixed(2) : 0;
  const averageOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;

  return {
    clicks: totalClicks,
    orders: totalOrders,
    revenue: totalRevenue,
    commissions: totalCommissions,
    conversionRate: parseFloat(conversionRate),
    averageOrderValue: parseFloat(averageOrderValue)
  };
}

// Helper function to get empty stats
function getEmptyStats(period) {
  return {
    period,
    clicks: 0,
    orders: 0,
    revenue: 0,
    commissions: 0,
    conversionRate: 0,
    averageOrderValue: 0
  };
}

// Get recent activity
async function getRecentActivity(storeIds) {
  const activities = [];

  // Recent affiliate applications (last 7 days)
  const recentApplications = await Affiliate.find({
    'stores.store': { $in: storeIds },
    'stores.status': 'pending',
    'stores.createdAt': { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  })
    .populate('user', 'username email')
    .limit(5)
    .sort({ 'stores.createdAt': -1 });

  recentApplications.forEach(affiliate => {
    affiliate.stores.forEach(storeApp => {
      if (storeIds.includes(storeApp.store.toString()) && storeApp.status === 'pending') {
        activities.push({
          type: 'affiliate_application',
          message: `${affiliate.user?.username || 'Affiliate'} applied to your program`,
          date: storeApp.createdAt,
          affiliateId: affiliate._id,
          storeId: storeApp.store
        });
      }
    });
  });

  // Recent orders
  const recentOrders = await Order.find({
    store: { $in: storeIds }
  })
    .populate('affiliate', 'user')
    .sort({ createdAt: -1 })
    .limit(5);

  recentOrders.forEach(order => {
    activities.push({
      type: 'order',
      message: `New order #${order.orderId || order._id.toString().slice(-8)} from ${order.affiliate?.user?.username || 'Affiliate'}`,
      date: order.createdAt,
      orderId: order._id,
      amount: order.totalAmount
    });
  });

  // Sort by date and return top 10
  return activities
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);
}

// Get top performing affiliates
async function getTopAffiliates(storeIds, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const topAffiliates = await Order.aggregate([
    {
      $match: {
        store: { $in: storeIds },
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$affiliate',
        totalRevenue: { $sum: '$totalAmount' },
        totalCommissions: { $sum: '$commissionAmount' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $sort: { totalRevenue: -1 }
    },
    {
      $limit: 10
    }
  ]);

  // Populate affiliate details
  const affiliateIds = topAffiliates.map(a => a._id);
  const affiliates = await Affiliate.find({
    _id: { $in: affiliateIds }
  }).populate('user', 'username email');

  return topAffiliates.map(stat => {
    const affiliate = affiliates.find(a => a._id.toString() === stat._id.toString());
    return {
      affiliateId: stat._id,
      username: affiliate?.user?.username || 'Unknown',
      email: affiliate?.user?.email || '',
      totalRevenue: stat.totalRevenue,
      totalCommissions: stat.totalCommissions,
      orderCount: stat.orderCount
    };
  });
}

// Get revenue trend data
async function getRevenueTrend(storeIds, dateRange, startDate, endDate) {
  let start, end;
  const now = new Date();

  if (dateRange === 'custom' && startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else if (dateRange === '7') {
    start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (dateRange === '30') {
    start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (dateRange === '90') {
    start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    end = now;
  } else {
    start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    end = now;
  }

  // Group by day
  const revenueData = await Order.aggregate([
    {
      $match: {
        store: { $in: storeIds },
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  return revenueData.map(item => ({
    date: item._id,
    revenue: item.revenue,
    orders: item.orders
  }));
}

// Get clicks and conversions trend
async function getClicksConversionsTrend(storeIds, dateRange, startDate, endDate) {
  let start, end;
  const now = new Date();

  if (dateRange === 'custom' && startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else if (dateRange === '7') {
    start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (dateRange === '30') {
    start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (dateRange === '90') {
    start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    end = now;
  } else {
    start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    end = now;
  }

  // Get clicks by day
  const clicksData = await Click.aggregate([
    {
      $match: {
        store: { $in: storeIds },
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        clicks: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  // Get conversions by day
  const conversionsData = await Order.aggregate([
    {
      $match: {
        store: { $in: storeIds },
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        conversions: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  // Combine data
  const dateMap = new Map();
  
  clicksData.forEach(item => {
    dateMap.set(item._id, { date: item._id, clicks: item.clicks, conversions: 0 });
  });

  conversionsData.forEach(item => {
    if (dateMap.has(item._id)) {
      dateMap.get(item._id).conversions = item.conversions;
    } else {
      dateMap.set(item._id, { date: item._id, clicks: 0, conversions: item.conversions });
    }
  });

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Get alerts and notifications
async function getAlerts(merchantId, storeIds) {
  const alerts = [];

  // Pending affiliate applications
  const pendingApplications = await Affiliate.countDocuments({
    'stores.store': { $in: storeIds },
    'stores.status': 'pending'
  });

  if (pendingApplications > 0) {
    alerts.push({
      type: 'pending_applications',
      severity: 'info',
      message: `${pendingApplications} affiliate application${pendingApplications > 1 ? 's' : ''} pending approval`,
      count: pendingApplications,
      link: '/dashboard/affiliates'
    });
  }

  // Pending commissions
  const pendingCommissions = await Commission.aggregate([
    {
      $match: {
        store: { $in: storeIds },
        status: 'pending'
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        total: { $sum: '$amount' }
      }
    }
  ]);

  if (pendingCommissions.length > 0 && pendingCommissions[0].count > 0) {
    alerts.push({
      type: 'pending_commissions',
      severity: 'warning',
      message: `${pendingCommissions[0].count} pending commission${pendingCommissions[0].count > 1 ? 's' : ''} ($${pendingCommissions[0].total.toFixed(2)})`,
      count: pendingCommissions[0].count,
      amount: pendingCommissions[0].total,
      link: '/dashboard/commissions'
    });
  }

  // Low wallet balance alert
  try {
    const MerchantWallet = require('../models/MerchantWallet');
    const wallet = await MerchantWallet.findOne({ merchant: merchantId });
    
    if (wallet && wallet.settings.alertEnabled && wallet.isLowBalance()) {
      alerts.push({
        type: 'low_balance',
        severity: 'warning',
        message: `Low wallet balance: ${wallet.currency} ${wallet.balance.available.toFixed(2)} (below ${wallet.currency} ${wallet.settings.lowBalanceAlert.toFixed(2)})`,
        amount: wallet.balance.available,
        threshold: wallet.settings.lowBalanceAlert,
        link: '/dashboard/wallet'
      });
    }
  } catch (error) {
    console.error('Error checking wallet balance for alerts:', error);
  }

  return alerts;
}

