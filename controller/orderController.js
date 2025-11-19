const Order = require('../models/order');
const Store = require('../models/store');
const Affiliate = require('../models/affiliate');
const Commission = require('../models/commission');
const Click = require('../models/click');
const { sendResponse } = require('../utils/response');

// Process order from webhook
exports.processOrder = async (req, res, next) => {
  try {
    const { storeId, orderData, cookieId, referralCode } = req.body;

    // Find store
    const store = await Store.findById(storeId);
    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Find affiliate by referral code or cookie
    let affiliate = null;
    let click = null;

    if (referralCode) {
      const affiliateDoc = await Affiliate.findOne({ referralCode: referralCode.toUpperCase() });
      if (affiliateDoc) {
        affiliate = affiliateDoc;
      }
    } else if (cookieId) {
      // Find most recent click for this cookie
      click = await Click.findOne({ cookieId, store: storeId })
        .sort({ createdAt: -1 })
        .populate('affiliate');
      
      if (click && click.affiliate) {
        affiliate = click.affiliate;
      }
    }

    // Check if affiliate is approved for this store
    if (affiliate) {
      const storeApplication = affiliate.stores.find(
        s => s.store.toString() === storeId.toString()
      );

      if (!storeApplication || storeApplication.status !== 'approved') {
        affiliate = null; // Don't attribute if not approved
      }
    }

    // Create order
    const order = new Order({
      store: storeId,
      affiliate: affiliate ? affiliate._id : null,
      externalOrderId: orderData.orderNumber || orderData.id,
      orderData: {
        orderNumber: orderData.orderNumber || orderData.id,
        customerEmail: orderData.customerEmail || orderData.email,
        customerName: orderData.customerName || orderData.name,
        items: orderData.items || [],
        subtotal: orderData.subtotal || orderData.total,
        tax: orderData.tax || 0,
        shipping: orderData.shipping || 0,
        discount: orderData.discount || 0,
        total: orderData.total,
        currency: orderData.currency || 'USD',
        status: orderData.status || 'pending',
        paymentMethod: orderData.paymentMethod,
        paymentStatus: orderData.paymentStatus,
        shippingAddress: orderData.shippingAddress
      },
      clickId: click ? click._id : null,
      cookieId: cookieId,
      referralCode: referralCode,
      orderDate: orderData.orderDate ? new Date(orderData.orderDate) : new Date(),
      status: 'pending'
    });

    await order.save();

    // Calculate commission if affiliate exists
    if (affiliate) {
      const storeApplication = affiliate.stores.find(
        s => s.store.toString() === storeId.toString()
      );

      const commissionRate = storeApplication?.commissionRate || 
                            store.settings.defaultCommissionRate;
      const commissionType = store.settings.commissionType || 'percentage';

      order.calculateCommission(commissionRate, commissionType);
      await order.save();

      // Create commission record
      const commission = new Commission({
        affiliate: affiliate._id,
        store: storeId,
        order: order._id,
        amount: order.commission.amount,
        rate: order.commission.rate,
        orderTotal: order.orderData.total,
        currency: order.orderData.currency,
        status: 'pending'
      });

      await commission.save();

      // Reserve funds in merchant wallet for pending commission
      try {
        const walletController = require('../controllers/walletController');
        await walletController.reserveFunds(
          store.merchant,
          commission.amount,
          {
            type: 'commission',
            id: commission._id
          },
          `Reserve for pending commission - Order ${order.orderData.orderNumber}`
        );
      } catch (walletError) {
        // Log error but don't fail order creation
        // Commission is created but wallet wasn't updated
        console.error('Wallet reservation failed during commission creation:', walletError);
      }

      // Update affiliate stats
      if (storeApplication) {
        storeApplication.stats.orders += 1;
        storeApplication.stats.revenue += order.orderData.total;
        storeApplication.stats.commissions += commission.amount;
        if (click) {
          storeApplication.stats.conversions += 1;
        }
      }
      affiliate.stats.totalOrders += 1;
      affiliate.stats.totalRevenue += order.orderData.total;
      affiliate.stats.totalEarnings += commission.amount;
      affiliate.stats.totalPending += commission.amount;
      await affiliate.save();

      // Update click if exists
      if (click) {
        click.converted = true;
        click.convertedAt = new Date();
        click.orderId = order._id;
        await click.save();
      }
    }

    // Update store stats
    store.stats.totalOrders += 1;
    store.stats.totalRevenue += order.orderData.total;
    if (affiliate) {
      store.stats.totalCommissions += order.commission.amount;
    }
    await store.save();

    return sendResponse(res, 201, 'Order processed successfully', {
      order,
      commission: affiliate ? await Commission.findOne({ order: order._id }) : null
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse(res, 400, 'Order already exists', null);
    }
    next(error);
  }
};

// Get orders for store (merchant view)
exports.getStoreOrders = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { page = 1, limit = 20, status, affiliateId } = req.query;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Build query
    const query = { store: storeId };
    if (status) query.status = status;
    if (affiliateId) query.affiliate = affiliateId;

    const orders = await Order.find(query)
      .populate('affiliate', 'referralCode')
      .populate('clickId', 'createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    return sendResponse(res, 200, 'Orders retrieved successfully', {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get orders for affiliate
exports.getAffiliateOrders = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Get affiliate
    const affiliate = await Affiliate.findOne({ user: req.user.id });
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate profile not found', null);
    }

    // Build query
    const query = { affiliate: affiliate._id };
    if (storeId) query.store = storeId;

    const orders = await Order.find(query)
      .populate('store', 'name domain')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    return sendResponse(res, 200, 'Orders retrieved successfully', {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get single order
exports.getOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('store', 'name domain')
      .populate('affiliate', 'referralCode')
      .populate('clickId');

    if (!order) {
      return sendResponse(res, 404, 'Order not found', null);
    }

    // Check permissions
    if (req.user.role === 'advertiser' || req.user.role === 'admin') {
      const store = await Store.findOne({ _id: order.store, merchant: req.user.id });
      if (!store) {
        return sendResponse(res, 403, 'Access denied', null);
      }
    } else if (req.user.role === 'affiliate') {
      const affiliate = await Affiliate.findOne({ user: req.user.id });
      if (!affiliate || order.affiliate?.toString() !== affiliate._id.toString()) {
        return sendResponse(res, 403, 'Access denied', null);
      }
    }

    return sendResponse(res, 200, 'Order retrieved successfully', order);
  } catch (error) {
    next(error);
  }
};

// Update order status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return sendResponse(res, 404, 'Order not found', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: order.store,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 403, 'Access denied', null);
    }

    order.status = status;
    await order.save();

    // If order is cancelled or refunded, handle commission
    if (status === 'cancelled' || status === 'refunded') {
      const commission = await Commission.findOne({ order: order._id });
      if (commission && commission.status !== 'paid') {
        commission.status = status === 'cancelled' ? 'cancelled' : 'refunded';
        await commission.save();

        // Update affiliate stats
        if (order.affiliate) {
          const affiliate = await Affiliate.findById(order.affiliate);
          if (affiliate) {
            affiliate.stats.totalPending -= commission.amount;
            affiliate.stats.totalEarnings -= commission.amount;
            await affiliate.save();
          }
        }
      }
    }

    return sendResponse(res, 200, 'Order status updated successfully', order);
  } catch (error) {
    next(error);
  }
};

