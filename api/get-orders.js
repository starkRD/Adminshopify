// api/get-orders.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
});

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all rows from the order_history table
    const result = await pool.query('SELECT * FROM order_history');
    return res.status(200).json({ history: result.rows });
  } catch (error) {
    console.error("Error retrieving order history:", error);
    return res.status(500).json({ error: 'Failed to retrieve order history' });
  }
};
