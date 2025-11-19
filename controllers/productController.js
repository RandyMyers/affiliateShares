const Product = require('../models/Product');
const Store = require('../models/Store');
const { sendResponse } = require('../utils/response');

/**
 * Get all products for a store
 */
exports.getStoreProducts = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { status, category, page = 1, limit = 50 } = req.query;

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
    if (category) query.category = category;

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    return sendResponse(res, 200, 'Products retrieved successfully', {
      products,
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

/**
 * Get single product
 */
exports.getProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId).populate('store', 'name domain');

    if (!product) {
      return sendResponse(res, 404, 'Product not found', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: product.store._id,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 403, 'Access denied', null);
    }

    return sendResponse(res, 200, 'Product retrieved successfully', product);
  } catch (error) {
    next(error);
  }
};

/**
 * Create product
 */
exports.createProduct = async (req, res, next) => {
  try {
    const { storeId } = req.params;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Check if SKU already exists for this store
    if (req.body.sku) {
      const existing = await Product.findOne({
        store: storeId,
        sku: req.body.sku
      });

      if (existing) {
        return sendResponse(res, 400, 'Product with this SKU already exists', null);
      }
    }

    const product = new Product({
      ...req.body,
      store: storeId
    });

    await product.save();

    return sendResponse(res, 201, 'Product created successfully', product);
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse(res, 400, 'Product with this SKU already exists', null);
    }
    next(error);
  }
};

/**
 * Update product
 */
exports.updateProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);

    if (!product) {
      return sendResponse(res, 404, 'Product not found', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: product.store,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 403, 'Access denied', null);
    }

    // Check SKU uniqueness if being updated
    if (req.body.sku && req.body.sku !== product.sku) {
      const existing = await Product.findOne({
        store: product.store,
        sku: req.body.sku,
        _id: { $ne: productId }
      });

      if (existing) {
        return sendResponse(res, 400, 'Product with this SKU already exists', null);
      }
    }

    Object.assign(product, req.body);
    await product.save();

    return sendResponse(res, 200, 'Product updated successfully', product);
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse(res, 400, 'Product with this SKU already exists', null);
    }
    next(error);
  }
};

/**
 * Delete product
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);

    if (!product) {
      return sendResponse(res, 404, 'Product not found', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: product.store,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 403, 'Access denied', null);
    }

    await product.deleteOne();

    return sendResponse(res, 200, 'Product deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk import products
 */
exports.bulkImportProducts = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { products } = req.body; // Array of product objects

    if (!products || !Array.isArray(products) || products.length === 0) {
      return sendResponse(res, 400, 'Products array is required', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: []
    };

    for (const productData of products) {
      try {
        // Check if product with SKU exists
        if (productData.sku) {
          const existing = await Product.findOne({
            store: storeId,
            sku: productData.sku
          });

          if (existing) {
            results.skipped++;
            continue;
          }
        }

        const product = new Product({
          ...productData,
          store: storeId
        });

        await product.save();
        results.created++;
      } catch (error) {
        results.errors.push({
          sku: productData.sku,
          error: error.message
        });
      }
    }

    return sendResponse(res, 200, 'Bulk import completed', results);
  } catch (error) {
    next(error);
  }
};

