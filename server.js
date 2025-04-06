const express = require('express');
const axios = require('axios');
const cookieSession = require('cookie-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Retrieve environment variables (set these in Vercel)
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN; // Your permanent token
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'your-store.myshopify.com';
const FORWARDING_ADDRESS = process.env.FORWARDING_ADDRESS; // e.g., "https://adminshopify.vercel.app"

// Passwords for different roles/viewers
const DASHBOARD_ADMIN_PASSWORD = process.env.DASHBOARD_ADMIN_PASSWORD;
const DASHBOARD_SHANU_PASSWORD = process.env.DASHBOARD_SHANU_PASSWORD; // Viewer who sees Hindi, English, Tamil, Malayalam
const DASHBOARD_HINDI_PASSWORD = process.env.DASHBOARD_HINDI_PASSWORD; // Only Hindi orders
const DASHBOARD_ENGLISH_PASSWORD = process.env.DASHBOARD_ENGLISH_PASSWORD; // Only English orders
const DASHBOARD_TAMIL_PASSWORD = process.env.DASHBOARD_TAMIL_PASSWORD; // Only Tamil orders
const DASHBOARD_TELUGU_PASSWORD = process.env.DASHBOARD_TELUGU_PASSWORD; // Only Telugu orders
const DASHBOARD_KANNADA_PASSWORD = process.env.DASHBOARD_KANNADA_PASSWORD; // Only Kannada orders
const DASHBOARD_MALAYALAM_PASSWORD = process.env.DASHBOARD_MALAYALAM_PASSWORD; // Only Malayalam orders

app.use(express.urlencoded({ extended: true })); // to parse form data
app.use(express.json()); // to parse JSON bodies

app.use(cookieSession({
  name: 'session',
  keys: [process.env.COOKIE_SECRET || 'default-secret'],
}));

// Set views directory and view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Serve static files from 'public'
app.use(express.static('public'));

// ---------------------------
// LOGIN & ROLE SETUP
// ---------------------------

// Login page
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Process login; set session role and allowed languages
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === DASHBOARD_ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'admin';
    req.session.languages = null; // Admin sees all orders
    res.redirect('/dashboard');
  } else if (password === DASHBOARD_SHANU_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Hindi', 'English', 'Tamil', 'Malayalam'];
    res.redirect('/dashboard');
  } else if (password === DASHBOARD_HINDI_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Hindi'];
    res.redirect('/dashboard');
  } else if (password === DASHBOARD_ENGLISH_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['English'];
    res.redirect('/dashboard');
  } else if (password === DASHBOARD_TAMIL_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Tamil'];
    res.redirect('/dashboard');
  } else if (password === DASHBOARD_TELUGU_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Telugu'];
    res.redirect('/dashboard');
  } else if (password === DASHBOARD_KANNADA_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Kannada'];
    res.redirect('/dashboard');
  } else if (password === DASHBOARD_MALAYALAM_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Malayalam'];
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: 'Invalid password. Please try again.' });
  }
});

// Middleware to require login
function requireLogin(req, res, next) {
  if (req.session.loggedIn) {
    return next();
  }
  res.redirect('/login');
}

// Middleware to require admin for updates
function requireAdmin(req, res, next) {
  if (req.session.role && req.session.role === 'admin') {
    return next();
  }
  res.status(403).send('Access denied: Admins only.');
}

// ---------------------------
// DASHBOARD ROUTE
// ---------------------------
app.get('/dashboard', requireLogin, async (req, res) => {
  const shop = SHOPIFY_SHOP_DOMAIN;
  const accessToken = SHOPIFY_ACCESS_TOKEN;
  
  try {
    const ordersResponse = await axios.get(`https://${shop}/admin/api/2023-04/orders.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    let orders = ordersResponse.data.orders;
    
    // If the user is not admin, filter orders by allowed language.
    if (req.session.role !== 'admin') {
      const allowedLanguages = req.session.languages; // e.g., ['Hindi']
      orders = orders.filter(order => {
        // Determine the order's language by checking line items.
        // We assume the language is stored in a property called "Language" (or within "Form Data").
        let orderLanguage = null;
        order.line_items.forEach(item => {
          if (item.properties && item.properties.length > 0) {
            item.properties.forEach(prop => {
              const propName = prop.name.toLowerCase();
              // If it's "language" or contained in a "form data" block, try to extract it.
              if (propName.includes('language')) {
                // If the property is "Form Data", it might be multi-line. Otherwise, use the value.
                if (propName.includes('form data')) {
                  // Split the value by newlines and look for a line starting with "Language:"
                  const lines = prop.value.split('\n');
                  lines.forEach(line => {
                    if (line.toLowerCase().startsWith('language:')) {
                      orderLanguage = line.split(':')[1].trim();
                    }
                  });
                } else {
                  orderLanguage = prop.value;
                }
              }
            });
          }
        });
        // Include the order only if its language is one of the allowed languages.
        return orderLanguage && allowedLanguages.includes(orderLanguage);
      });
    }
    
    res.render('dashboard', { orders, role: req.session.role });
  } catch (error) {
    console.error('Error fetching orders:', error.response?.data || error.message);
    res.status(500).send('Error fetching orders');
  }
});

// ---------------------------
// Feedback Update Endpoint (Admin only)
// ---------------------------
app.post('/update-feedback', requireLogin, requireAdmin, (req, res) => {
  // Normally update your database or Shopify metafields.
  res.json({ status: 'success' });
});

// Redirect root to login or dashboard
app.get('/', (req, res) => {
  if (req.session.loggedIn) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

app.listen(PORT, () => {
  console.log(`App running on port ${PORT}`);
});
