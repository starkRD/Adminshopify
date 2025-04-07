// api/update-order.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
});

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderId, updates } = req.body;
  if (!orderId || !updates) {
    return res.status(400).json({ error: 'Missing orderId or updates' });
  }

  try {
    const { note, done, editing, delivered } = updates;
    const query = `
      INSERT INTO order_history (order_id, note, done, editing, delivered)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [
      orderId,
      note || '',
      done || false,
      editing || false,
      delivered || false,
    ];
    const result = await pool.query(query, values);
    return res.status(200).json({ message: 'Order updated (history row inserted)', data: result.rows[0] });
  } catch (error) {
    console.error('Error updating order history:', error);
    return res.status(500).json({ error: 'Failed to update order' });
  }
};
