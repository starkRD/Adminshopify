import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
});

export default async function handler(req, res) {
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
      INSERT INTO orders (order_id, note, done, editing, delivered)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (order_id)
      DO UPDATE SET
        note = EXCLUDED.note,
        done = EXCLUDED.done,
        editing = EXCLUDED.editing,
        delivered = EXCLUDED.delivered
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
    return res.status(200).json({ message: 'Order updated', data: result.rows[0] });
  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({ error: 'Failed to update order' });
  }
}
