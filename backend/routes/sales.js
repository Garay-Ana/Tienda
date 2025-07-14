const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const verifyToken = require('../middleware/authMiddleware');

// Listar ventas con filtros para vendedor autenticado
router.get('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'seller') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const { startDate, endDate, customerName, paymentMethod } = req.query;
    const filter = { seller: req.user.id };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    if (customerName) {
      filter.customerName = { $regex: customerName, $options: 'i' };
    }
    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    const sales = await Order.find(filter).sort({ createdAt: -1 });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

// Crear venta
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'seller') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const { saleDate, customerName, customerPhone, products, quantity, totalPrice, hasSeller, sellerCode, sellerName, paymentMethod, notes } = req.body;

    if (!customerName || !customerPhone || !products || !quantity || !totalPrice) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Procesar productos: se espera que products sea string con nombres separados por comas
    const productNames = products.split(',').map(p => p.trim()).filter(p => p.length > 0);

    // Buscar productos en DB para obtener sus IDs y precios
    const items = [];
    for (let name of productNames) {
      name = name.trim();
      console.log('Buscando producto:', name);
      // Buscar producto con regex para coincidencia parcial, ignorando mayúsculas y espacios extra
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escapar caracteres especiales regex
      const product = await Product.findOne({ name: { $regex: escapedName, $options: 'i' } });
      if (!product) {
        console.log('Producto no encontrado en DB:', name);
        return res.status(400).json({ error: `Producto no encontrado: ${name}` });
      }
      console.log('Producto encontrado:', product.name);
      items.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: Number(quantity) || 1
      });
    }

    const order = new Order({
      createdAt: new Date(),
      customerName,
      customerEmail: '', // Eliminado email obligatorio
      address: 'No especificada', // Valor por defecto para evitar error de validación
      items,
      total: totalPrice || 0,
      seller: req.user.id,
      sellerCode: hasSeller === 'Sí' ? sellerCode : 'VENTA DIRECTA',
      paymentMethod,
      notes
    });

    await order.save();
    res.status(201).json(order);
  } catch (error) {
    console.error('Error al crear venta:', error);
    res.status(500).json({ error: error.message || 'Error al crear venta' });
  }
});

module.exports = router;
