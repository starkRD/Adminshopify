const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const cookieSession = require('cookie-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables will be set on Vercel.
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = 'read_orders,write_orders';
const FORWARDING_ADDRESS = process.env.FORWARDING_ADDRESS; // e.g., "https://songcart-dashboard.vercel.app"

app.use(cookieSession({
  name: 'session',
  keys: [process.env.COOKIE_SECRET || 'default-secret'],
}));

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Start OAuth Flow
app.get('/auth', (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send('No shop provided');
  const state = crypto.randomBytes(16).toString('hex');
  req.session.state = state;
  const redirectUri = `${FORWARDING_ADDRESS}/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&state=${state}&redirect_uri=${redirectUri}`;
  res.redirect(installUrl);
});

// Handle OAuth Callback
app.get('/auth/callback', async (req, res) => {
  const { shop, hmac, code, state } = req.query;
  if (state !== req.session.state) {
    return res.status(403).send('Request origin cannot be verified');
  }
  const map = { ...req.query };
  delete map.hmac;
  delete map.signature;
  const message = Object.keys(map).sort().map(key => `${key}=${map[key]}`).join('&');
  const generatedHash = crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(message).digest('hex');
  if (generatedHash !== hmac) {
    return res.status(400).send('HMAC validation failed');
  }
  try {
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code,
    });
    req.session.accessToken = tokenResponse.data.access_token;
    req.session.shop = shop;
    res.redirect('/dashboard');
  } catch (error) {
    res.status(500).send('Error during token exchange');
  }
});

// Dashboard: Fetch Orders and Render
app.get('/dashboard', async (req, res) => {
  if (!req.session.accessToken || !req.session.shop) {
    return res.redirect('/auth?shop=your-store.myshopify.com');
  }
  const shop = req.session.shop;
  const accessToken = req.session.accessToken;
  try {
    const ordersResponse = await axios.get(`https://${shop}/admin/api/2023-04/orders.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    const orders = ordersResponse.data.orders;
    res.render('dashboard', { orders });
  } catch (error) {
    res.status(500).send('Error fetching orders');
  }
});

// For testing feedback updates (optional)
app.post('/update-feedback', express.json(), (req, res) => {
  // This is where you'd update Shopify or your database.
  // For now, we just return success.
  res.json({ status: 'success' });
});

app.listen(PORT, () => {
  console.log(`App running on port ${PORT}`);
});

