const express = require('express');
const axios = require('axios');
const cookieSession = require('cookie-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables from Vercel
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN; // your permanent token
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'your-store.myshopify.com';
const FORWARDING_ADDRESS = process.env.FORWARDING_ADDRESS; // e.g., "https://adminshopify.vercel.app"

// Passwords for roles:
const DASHBOARD_ADMIN_PASSWORD = process.env.DASHBOARD_ADMIN_PASSWORD;
const DASHBOARD_VIEWER_PASSWORD = process.env.DASHBOARD_VIEWER_PASSWORD;

app.use(express.urlencoded({ extended: true })); // for form data
app.use(express.json()); // for JSON requests

app.use(cookieSession({
  name: 'session',
  keys: [process.env.COOKIE_SECRET || 'default-secret'],
}));

// Set views directory and view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Serve static files from 'public'
app.use(express.static('public'));

// Middleware to require login for protected routes
function requireLogin(req, res, next) {
  if (req.session.loggedIn) {
    return next();
  }
  res.redirect('/login');
}

// Middleware to require admin role for updates
function requireAdmin(req, res, next) {
  if (req.session.role && req.session.role === 'admin') {
    return next();
  }
  res.status(403).send('Access denied: Admins only.');
}

// Login Routes
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === DASHBOARD_ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'admin';
    res.redirect('/dashboard');
  } else if (password === DASHBOARD_VIEWER_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: 'Invalid password. Please try again.' });
  }
});

// Dashboard route: Protected, fetch orders using the permanent access token
app.get('/dashboard', requireLogin, async (req, res) => {
  const shop = SHOPIFY_SHOP_DOMAIN;
  const accessToken = SHOPIFY_ACCESS_TOKEN;
  
  try {
    const ordersResponse = await axios.get(`https://${shop}/admin/api/2023-04/orders.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    const orders = ordersResponse.data.orders;
    res.render('dashboard', { orders, role: req.session.role });
  } catch (error) {
    console.error('Error fetching orders:', error.response?.data || error.message);
    res.status(500).send('Error fetching orders');
  }
});

// Endpoint to update feedback (only for admin)
app.post('/update-feedback', requireLogin, requireAdmin, (req, res) => {
  // Normally, you'd update your database or Shopify metafields.
  // For this example, we simply return success.
  res.json({ status: 'success' });
});

app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

app.listen(PORT, () => {
  console.log(`App running on port ${PORT}`);
});
