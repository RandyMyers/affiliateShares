const Store = require('../models/store');
const AffiliateProgram = require('../models/affiliateProgram');
const Affiliate = require('../models/affiliate');
const Order = require('../models/order');
const Commission = require('../models/commission');
const Click = require('../models/click');

/**
 * Get dashboard statistics for a merchant
 */
exports.getDashboardStats = async (userId, dateRange = {}) => {
  const { startDate, endDate } = getDateRange(dateRange);

  // Get all stores for merchant
  const stores = await Store.find({ merchant: userId });
  const storeIds = stores.map(s => s._id);

  // Get all programs for merchant
  const programs = await AffiliateProgram.find({ merchant: userId });
  const programIds = programs.map(p => p._id);

  // Get orders in date range
  const ordersQuery = {
    store: { $in: storeIds },
    createdAt: { $gte: startDate, $lte: endDate }
  };
  const orders = await Order.find(ordersQuery);

  // Get commissions in date range
  const commissionsQuery = {
    programId: { $in: programIds },
    createdAt: { $gte: startDate, $lte: endDate }
  };
  const commissions = await Commission.find(commissionsQuery);

  // Calculate stats
  const totalStores = stores.length;
  const totalPrograms = programs.length;
  const totalAffiliates = await Affiliate.countDocuments({
    'programs.programId': { $in: programIds },
    'programs.status': 'active'
  });

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

  const totalCommissions = commissions.reduce((sum, c) => {
    if (c.status === 'approved' || c.status === 'paid') {
      return sum + (c.amount || 0);
    }
    return sum;
  }, 0);

  const pendingCommissions = commissions.filter(c => c.status === 'pending').length;
  const approvedCommissions = commissions.filter(c => c.status === 'approved' || c.status === 'paid').length;

  // Get clicks in date range
  const clicksQuery = {
    programId: { $in: programIds },
    clickedAt: { $gte: startDate, $lte: endDate }
  };
  const totalClicks = await Click.countDocuments(clicksQuery);

  const conversionRate = totalClicks > 0 ? ((totalOrders / totalClicks) * 100).toFixed(2) : 0;

  return {
    totalStores,
    totalPrograms,
    totalAffiliates,
    totalOrders,
    totalRevenue,
    totalCommissions,
    pendingCommissions,
    approvedCommissions,
    totalClicks,
    conversionRate: parseFloat(conversionRate)
  };
};

/**
 * Get program analytics
 */
exports.getProgramStats = async (programId, dateRange = {}) => {
  const { startDate, endDate } = getDateRange(dateRange);

  const program = await AffiliateProgram.findById(programId);
  if (!program) {
    throw new Error('Program not found');
  }

  // Get affiliates
  const affiliates = await Affiliate.find({
    'programs.programId': programId,
    'programs.status': 'active'
  });

  // Get clicks
  const clicksQuery = {
    programId: programId,
    clickedAt: { $gte: startDate, $lte: endDate }
  };
  const clicks = await Click.find(clicksQuery);

  // Get orders
  const orders = await Order.find({
    store: program.store,
    createdAt: { $gte: startDate, $lte: endDate },
    affiliateId: { $exists: true }
  }).populate('affiliateId', 'programs');

  // Filter orders for this program
  const programOrders = orders.filter(order => {
    const affiliateProgram = order.affiliateId?.programs?.find(
      p => p.programId?.toString() === programId
    );
    return affiliateProgram;
  });

  // Get commissions
  const commissionsQuery = {
    programId: programId,
    createdAt: { $gte: startDate, $lte: endDate }
  };
  const commissions = await Commission.find(commissionsQuery);

  const totalAffiliates = affiliates.length;
  const totalClicks = clicks.length;
  const totalOrders = programOrders.length;
  const totalRevenue = programOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const totalCommissions = commissions.reduce((sum, c) => {
    if (c.status === 'approved' || c.status === 'paid') {
      return sum + (c.amount || 0);
    }
    return sum;
  }, 0);

  const conversionRate = totalClicks > 0 ? ((totalOrders / totalClicks) * 100).toFixed(2) : 0;

  return {
    program: {
      id: program._id,
      name: program.name,
      status: program.status
    },
    totalAffiliates,
    totalClicks,
    totalOrders,
    totalRevenue,
    totalCommissions,
    conversionRate: parseFloat(conversionRate),
    commissions: {
      pending: commissions.filter(c => c.status === 'pending').length,
      approved: commissions.filter(c => c.status === 'approved').length,
      paid: commissions.filter(c => c.status === 'paid').length
    }
  };
};

/**
 * Get affiliate performance analytics
 */
exports.getAffiliateStats = async (affiliateId, dateRange = {}) => {
  const { startDate, endDate } = getDateRange(dateRange);

  const affiliate = await Affiliate.findById(affiliateId);
  if (!affiliate) {
    throw new Error('Affiliate not found');
  }

  const programIds = affiliate.programs
    .filter(p => p.status === 'active')
    .map(p => p.programId);

  // Get clicks
  const clicksQuery = {
    affiliateId: affiliateId,
    clickedAt: { $gte: startDate, $lte: endDate }
  };
  const clicks = await Click.find(clicksQuery);

  // Get orders
  const ordersQuery = {
    affiliateId: affiliateId,
    createdAt: { $gte: startDate, $lte: endDate }
  };
  const orders = await Order.find(ordersQuery);

  // Get commissions
  const commissionsQuery = {
    affiliateId: affiliateId,
    programId: { $in: programIds },
    createdAt: { $gte: startDate, $lte: endDate }
  };
  const commissions = await Commission.find(commissionsQuery);

  const totalClicks = clicks.length;
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const totalCommissions = commissions.reduce((sum, c) => {
    if (c.status === 'approved' || c.status === 'paid') {
      return sum + (c.amount || 0);
    }
    return sum;
  }, 0);

  const conversionRate = totalClicks > 0 ? ((totalOrders / totalClicks) * 100).toFixed(2) : 0;

  return {
    affiliate: {
      id: affiliate._id,
      referralCode: affiliate.referralCode
    },
    totalClicks,
    totalOrders,
    totalRevenue,
    totalCommissions,
    conversionRate: parseFloat(conversionRate),
    commissions: {
      pending: commissions.filter(c => c.status === 'pending').length,
      approved: commissions.filter(c => c.status === 'approved').length,
      paid: commissions.filter(c => c.status === 'paid').length
    }
  };
};

/**
 * Get time series data for charts
 */
exports.getTimeSeriesData = async (userId, type, dateRange = {}) => {
  const { startDate, endDate } = getDateRange(dateRange);

  const stores = await Store.find({ merchant: userId });
  const storeIds = stores.map(s => s._id);

  const programs = await AffiliateProgram.find({ merchant: userId });
  const programIds = programs.map(p => p._id);

  // Generate date buckets
  const buckets = generateDateBuckets(startDate, endDate);
  const data = buckets.map(bucket => ({
    date: bucket.date,
    label: bucket.label,
    value: 0
  }));

  if (type === 'revenue') {
    const orders = await Order.find({
      store: { $in: storeIds },
      createdAt: { $gte: startDate, $lte: endDate }
    });

    orders.forEach(order => {
      const bucket = buckets.find(b => 
        order.createdAt >= b.start && order.createdAt <= b.end
      );
      if (bucket) {
        const dataPoint = data.find(d => d.date === bucket.date);
        if (dataPoint) {
          dataPoint.value += order.totalAmount || 0;
        }
      }
    });
  } else if (type === 'orders') {
    const orders = await Order.find({
      store: { $in: storeIds },
      createdAt: { $gte: startDate, $lte: endDate }
    });

    orders.forEach(order => {
      const bucket = buckets.find(b => 
        order.createdAt >= b.start && order.createdAt <= b.end
      );
      if (bucket) {
        const dataPoint = data.find(d => d.date === bucket.date);
        if (dataPoint) {
          dataPoint.value += 1;
        }
      }
    });
  } else if (type === 'clicks') {
    const clicks = await Click.find({
      programId: { $in: programIds },
      clickedAt: { $gte: startDate, $lte: endDate }
    });

    clicks.forEach(click => {
      const bucket = buckets.find(b => 
        click.clickedAt >= b.start && click.clickedAt <= b.end
      );
      if (bucket) {
        const dataPoint = data.find(d => d.date === bucket.date);
        if (dataPoint) {
          dataPoint.value += 1;
        }
      }
    });
  } else if (type === 'commissions') {
    const commissions = await Commission.find({
      programId: { $in: programIds },
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['approved', 'paid'] }
    });

    commissions.forEach(commission => {
      const bucket = buckets.find(b => 
        commission.createdAt >= b.start && commission.createdAt <= b.end
      );
      if (bucket) {
        const dataPoint = data.find(d => d.date === bucket.date);
        if (dataPoint) {
          dataPoint.value += commission.amount || 0;
        }
      }
    });
  }

  return data;
};

/**
 * Helper function to get date range
 */
function getDateRange(dateRange) {
  const now = new Date();
  let startDate, endDate;

  if (dateRange.startDate && dateRange.endDate) {
    startDate = new Date(dateRange.startDate);
    endDate = new Date(dateRange.endDate);
  } else if (dateRange.days) {
    endDate = now;
    startDate = new Date(now.getTime() - (dateRange.days * 24 * 60 * 60 * 1000));
  } else {
    // Default to last 30 days
    endDate = now;
    startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  }

  return { startDate, endDate };
}

/**
 * Helper function to generate date buckets
 */
function generateDateBuckets(startDate, endDate) {
  const buckets = [];
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let currentDate = new Date(startDate);

  if (diffDays <= 7) {
    // Daily buckets
    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      buckets.push({
        date: currentDate.toISOString().split('T')[0],
        label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        start: new Date(currentDate),
        end: new Date(nextDate)
      });
      currentDate = nextDate;
    }
  } else if (diffDays <= 30) {
    // Daily buckets
    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      buckets.push({
        date: currentDate.toISOString().split('T')[0],
        label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        start: new Date(currentDate),
        end: new Date(nextDate)
      });
      currentDate = nextDate;
    }
  } else if (diffDays <= 90) {
    // Weekly buckets
    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 7);
      buckets.push({
        date: currentDate.toISOString().split('T')[0],
        label: `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        start: new Date(currentDate),
        end: new Date(nextDate)
      });
      currentDate = nextDate;
    }
  } else {
    // Monthly buckets
    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
      buckets.push({
        date: currentDate.toISOString().split('T')[0],
        label: currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        start: new Date(currentDate),
        end: new Date(nextDate)
      });
      currentDate = nextDate;
    }
  }

  return buckets;
}

