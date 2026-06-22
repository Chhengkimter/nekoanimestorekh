const Product       = require('../models/Product');
const ImageUploader = require('../services/ImageUploader');

class ProductController {

  // ─── GET /api/products ───────────────────────────────────────
  // Public — customer product listing page
  static async getAll(req, res) {
    try {
      const { category, search, promotion, limit, offset } = req.query;
      const products = await Product.findAll({
        categoryId: category || null,
        search:     search   || null,
        promotion:  promotion || null,
        limit:      parseInt(limit)  || 20,
        offset:     parseInt(offset) || 0
      });
      res.status(200).json(products);
    } catch (err) {
      console.error('getAll error:', err.message);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  }


  // ─── GET /api/products/:id ───────────────────────────────────
  // Public — customer product detail page
  static async getOne(req, res) {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.status(200).json(product);
    } catch (err) {
      console.error('getOne error:', err.message);
      res.status(500).json({ error: 'Failed to fetch product' });
    }
  }


  // ─── POST /api/products ──────────────────────────────────────
  // Admin only — create product + upload images
  static async create(req, res) {
    try {
      const {
        productCode, productName, productDescription,
        productPrice, originalPrice, discount, discountFlat,
        productStock, stockStatus,
        categories, options         // arrays from admin panel
      } = req.body;

      // 1. Validate required fields
      if (!productName || !productPrice) {
        return res.status(400).json({ error: 'Product name and price are required' });
      }

      // 2. Create the product row
      const product = await Product.create({
        productCode, productName, productDescription,
        productPrice, originalPrice, discount, discountFlat,
        productStock, stockStatus
      });

      // 3. Upload images to R2 if any files sent
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const imageUrl = await ImageUploader.upload(req.files[i]);
          await Product.addImage(product.product_id, imageUrl, i === 0);
        }
      }

      // 4. Set categories if provided
      if (categories && categories.length > 0) {
        await Product.setCategories(product.product_id, categories);
      }

      // 6. Return full product
      const fullProduct = await Product.findById(product.product_id);
      res.status(201).json(fullProduct);

    } catch (err) {
      console.error('create product error:', err.message);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }


  // ─── PUT /api/products/:id ───────────────────────────────────
  // Admin only — update product info
  static async update(req, res) {
    try {
      const productId = req.params.id;

      // Check product exists
      const existing = await Product.findById(productId);
      if (!existing) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Update fields
      const updated = await Product.update(productId, req.body);

      // Update categories if provided
      if (req.body.categories) {
        await Product.setCategories(productId, req.body.categories);
      }

      const fullProduct = await Product.findById(productId);
      res.status(200).json(fullProduct);

    } catch (err) {
      console.error('update product error:', err.message);
      res.status(500).json({ error: 'Failed to update product' });
    }
  }


  // ─── DELETE /api/products/:id ────────────────────────────────
  // Admin only — delete product
  static async remove(req, res) {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Delete images from R2 first
      if (product.images && product.images.length > 0) {
        for (const img of product.images) {
          await ImageUploader.delete(img.image_url).catch(() => {});
        }
      }

      await Product.delete(req.params.id);
      res.status(200).json({ message: 'Product deleted successfully' });

    } catch (err) {
      console.error('delete product error:', err.message);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  }


  // ─── POST /api/products/:id/images ──────────────────────────
  // Admin only — add image to existing product
  static async addImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const isPrimary = req.body.isPrimary === 'true';
      const imageUrl  = await ImageUploader.upload(req.file);
      const image     = await Product.addImage(req.params.id, imageUrl, isPrimary);

      res.status(201).json(image);
    } catch (err) {
      console.error('addImage error:', err.message);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  }


  // ─── DELETE /api/products/:id/images/:imageId ───────────────
  // Admin only — delete one image
  static async deleteImage(req, res) {
    try {
      const deleted = await Product.deleteImage(req.params.imageId);
      if (!deleted) {
        return res.status(404).json({ error: 'Image not found' });
      }
      // Delete from R2
      await ImageUploader.delete(deleted.image_url).catch(() => {});
      res.status(200).json({ message: 'Image deleted' });
    } catch (err) {
      console.error('deleteImage error:', err.message);
      res.status(500).json({ error: 'Failed to delete image' });
    }
  }

  static async getVariants(req, res) {
    try {
      const variants = await Product.getVariants(req.params.id);
      res.status(200).json(variants);
    } catch (err) {
      console.error('getVariants error:', err.message);
      res.status(500).json({ error: 'Failed to fetch variants' });
    }
  }

  // ... your existing getAll, getOne, create, update, remove, addImage,
  //     deleteImage handlers stay exactly as they are ...

  // GET /api/products/:id/variants
  static async getVariants(req, res) {
    try {
      const variants = await Product.getVariants(req.params.id);
      res.json(variants);
    } catch (err) {
      console.error('getVariants error:', err);
      res.status(500).json({ error: 'Failed to load variants' });
    }
  }

  // POST /api/products/:id/variants
  // body: { variantName, variantStock, variantSku, variantPrice }
  // variantPrice is optional — omit or send null for "no override"
  static async addVariant(req, res) {
    try {
      const { variantName, variantStock, variantSku, variantPrice } = req.body;
      if (!variantName) return res.status(400).json({ error: 'variantName is required' });

      const priceVal = (variantPrice === '' || variantPrice === undefined) ? null : variantPrice;

      const variant = await Product.addVariant(
        req.params.id, variantName, variantStock, variantSku, priceVal
      );

      // Keep product_stock in sync since variants drive total stock
      await Product.syncProductStockFromVariants(req.params.id);

      res.status(201).json(variant);
    } catch (err) {
      console.error('addVariant error:', err);
      res.status(500).json({ error: 'Failed to add variant' });
    }
  }

  // PUT /api/products/:id/variants/:variantId
  // body: { variantStock?, variantName?, variantSku?, variantPrice?, clearPrice? }
  // clearPrice: true resets variant_price to NULL (falls back to base price)
  static async updateVariant(req, res) {
    try {
      const { variantStock, variantName, variantSku, variantPrice, clearPrice } = req.body;

      const variant = await Product.updateVariant(req.params.variantId, {
        variantStock, variantName, variantSku, variantPrice, clearPrice
      });

      if (!variant) return res.status(404).json({ error: 'Variant not found' });

      // Stock may have changed — resync product total
      await Product.syncProductStockFromVariants(req.params.id);

      res.json(variant);
    } catch (err) {
      console.error('updateVariant error:', err);
      res.status(500).json({ error: 'Failed to update variant' });
    }
  }

  // DELETE /api/products/:id/variants/:variantId
  static async deleteVariant(req, res) {
    try {
      const variant = await Product.deleteVariant(req.params.variantId);
      if (!variant) return res.status(404).json({ error: 'Variant not found' });

      await Product.syncProductStockFromVariants(req.params.id);

      res.json({ deleted: true, variant });
    } catch (err) {
      console.error('deleteVariant error:', err);
      res.status(500).json({ error: 'Failed to delete variant' });
    }
  }

  // PUT /api/products/:id/variants  (bulk replace)
  // body: { variants: [{ variantName, variantStock, variantSku, variantPrice }] }
  static async setVariants(req, res) {
    try {
      const { variants } = req.body;
      if (!Array.isArray(variants)) return res.status(400).json({ error: 'variants must be an array' });

      await Product.setVariants(req.params.id, variants);
      await Product.syncProductStockFromVariants(req.params.id);

      const updated = await Product.getVariants(req.params.id);
      res.json(updated);
    } catch (err) {
      console.error('setVariants error:', err);
      res.status(500).json({ error: 'Failed to set variants' });
    }
  }

}

module.exports = ProductController;