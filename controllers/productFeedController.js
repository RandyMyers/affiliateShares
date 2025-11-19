const Product = require('../models/Product');
const Store = require('../models/Store');
const { sendResponse } = require('../utils/response');

/**
 * Generate CSV product feed
 */
exports.generateCSVFeed = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { category, status = 'active' } = req.query;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Build query
    const query = { store: storeId, status };
    if (category) {
      query.category = category;
    }

    const products = await Product.find(query).sort({ name: 1 });

    // Generate CSV
    const csvHeaders = [
      'SKU',
      'Name',
      'Description',
      'Category',
      'Brand',
      'Price',
      'Sale Price',
      'Currency',
      'Product URL',
      'Image URL',
      'In Stock',
      'Stock Quantity',
      'Commission Rate',
      'Status'
    ];

    const csvRows = products.map(product => {
      return [
        product.sku || '',
        `"${(product.name || '').replace(/"/g, '""')}"`,
        `"${(product.description || '').replace(/"/g, '""')}"`,
        product.category || '',
        product.brand || '',
        product.price || 0,
        product.salePrice || '',
        product.currency || 'USD',
        product.productUrl || '',
        product.imageUrl || '',
        product.inStock ? 'Yes' : 'No',
        product.stockQuantity || 0,
        product.commissionRate || store.settings?.defaultCommissionRate || 0,
        product.status || 'active'
      ].join(',');
    });

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="product_feed_${storeId}_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
};

/**
 * Generate XML product feed (ShareASale/Commission Junction format)
 */
exports.generateXMLFeed = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { category, status = 'active' } = req.query;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Build query
    const query = { store: storeId, status };
    if (category) {
      query.category = category;
    }

    const products = await Product.find(query).sort({ name: 1 });

    // Generate XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<products>\n';

    products.forEach(product => {
      const commissionRate = product.commissionRate || store.settings?.defaultCommissionRate || 0;
      const price = product.salePrice || product.price || 0;

      xml += '  <product>\n';
      xml += `    <sku><![CDATA[${product.sku || ''}]]></sku>\n`;
      xml += `    <name><![CDATA[${product.name || ''}]]></name>\n`;
      xml += `    <description><![CDATA[${product.description || ''}]]></description>\n`;
      xml += `    <category><![CDATA[${product.category || ''}]]></category>\n`;
      if (product.brand) {
        xml += `    <brand><![CDATA[${product.brand}]]></brand>\n`;
      }
      xml += `    <price>${price}</price>\n`;
      xml += `    <currency>${product.currency || 'USD'}</currency>\n`;
      xml += `    <url><![CDATA[${product.productUrl || ''}]]></url>\n`;
      if (product.imageUrl) {
        xml += `    <image><![CDATA[${product.imageUrl}]]></image>\n`;
      }
      xml += `    <availability>${product.inStock ? 'in stock' : 'out of stock'}</availability>\n`;
      xml += `    <commission>${commissionRate}</commission>\n`;
      xml += '  </product>\n';
    });

    xml += '</products>';

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="product_feed_${storeId}_${Date.now()}.xml"`);
    res.send(xml);
  } catch (error) {
    next(error);
  }
};

/**
 * Get product feed URL (for affiliates to access)
 */
exports.getFeedUrl = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { format = 'xml' } = req.query;

    const store = await Store.findById(storeId);
    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Generate public feed URL
    const baseUrl = process.env.CLIENT_URL || process.env.PUBLISHER_URL || 'http://localhost:3001';
    const feedUrl = `${baseUrl}/api/public/feeds/${storeId}.${format}`;

    return sendResponse(res, 200, 'Feed URL retrieved successfully', {
      feedUrl,
      format,
      storeId
    });
  } catch (error) {
    next(error);
  }
};

