// /api/get-orders.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    // List all keys with prefix "order:"
    const { keys } = await kv.list({ prefix: 'order:' });
    const ordersData = {};

    // Loop through the keys and get the stored data
    for (const key of keys) {
      const orderId = key.replace('order:', '');
      ordersData[orderId] = await kv.get(key);
    }

    return res.status(200).json({ orders: ordersData });
  } catch (error) {
    console.error('Error retrieving orders:', error);
    return res.status(500).json({ error: 'Failed to retrieve orders' });
  }
}
