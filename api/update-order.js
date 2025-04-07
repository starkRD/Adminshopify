// /api/update-order.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { orderId, updates } = req.body;
  
  if (!orderId || !updates) {
    return res.status(400).json({ error: 'Missing orderId or updates' });
  }
  
  try {
    await kv.set(`order:${orderId}`, updates);
    return res.status(200).json({ message: 'Order updated successfully' });
  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({ error: 'Failed to update order' });
  }
}
