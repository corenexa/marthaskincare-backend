const express = require('express');
const { listProducts, getProductById } = require('../models/product');

const router = express.Router();

async function listStorefrontProducts(req, res) {
  try {
    const { inStockOnly } = req.query;
    let products = await listProducts();

    if (inStockOnly === 'true') {
      products = products.filter((product) => {
        if (typeof product.quantity !== 'number') return false;
        return product.quantity > 0;
      });
    }

    return res.json({ products });
  } catch (error) {
    console.error('Error listing storefront products:', error);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
}

async function getStorefrontProductById(req, res) {
  try {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json({ product });
  } catch (error) {
    console.error('Error fetching storefront product:', error);
    return res.status(500).json({ error: 'Failed to fetch product' });
  }
}

// Public routes under /api/storefront/*
router.get('/products', listStorefrontProducts);
router.get('/products/:id', getStorefrontProductById);

module.exports = {
  router,
  listStorefrontProducts,
  getStorefrontProductById,
};


