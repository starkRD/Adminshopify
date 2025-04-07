import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await pool.query('SELECT * FROM orders');
    const ordersData = {};
    for (const row of result.rows) {
      ordersData[row.order_id] = {
        note: row.note,
        done: row.done,
        editing: row.editing,
        delivered: row.delivered,
      };
    }
    return res.status(200).json({ orders: ordersData });
  } catch (error) {
    console.error('Error retrieving orders:', error);
    return res.status(500).json({ error: 'Failed to retrieve orders' });
  }
}
