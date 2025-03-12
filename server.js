const express = require('express');
const axios = require('axios');
const cookieSession = require('cookie-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Retrieve environment variables (set these in Vercel)
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY; // if needed
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN; // your permanent token
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'your-store.myshopify.com';
const FORWARDING_ADDRESS = process.env.FORWARDING_ADDRESS; // e.g., "https://your-app.vercel.app"

app.use(cookieSession({
  name: 'session',
  keys: [process.env.COOKIE_SECRET || 'default-secret'],
}));

// Set view engine to EJS and serve static files from 'public'
app.set('view engine', 'ejs');
app.use(express.static('public'));

// If you no longer need dynamic OAuth, you can remove these routes.
// Otherwise, you can keep them for future use. For now, we'll bypass OAuth:

// Dashboard route: Fetch orders using the permanent access token
app.get('/dashboard', async (req, res) => {
  const shop = SHOPIFY_SHOP_DOMAIN;
  const accessToken = SHOPIFY_ACCESS_TOKEN;
  
  try {
    const ordersResponse = await axios.get(`https://${shop}/admin/api/2023-04/orders.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    const orders = ordersResponse.data.orders;
    res.render('dashboard', { orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send('Error fetching orders');
  }
});

// Optional: Endpoint to update feedback (for internal use)
app.post('/update-feedback', express.json(), (req, res) => {
  // Here, you'd normally update your database or Shopify metafields.
  // For this example, we simply return success.
  res.json({ status: 'success' });
});

app.listen(PORT, () => {
  console.log(`App running on port ${PORT}`);
});
