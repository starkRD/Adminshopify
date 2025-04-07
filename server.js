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

// Passwords for different roles/viewers (set these in your environment)
const DASHBOARD_ADMIN_PASSWORD = process.env.DASHBOARD_ADMIN_PASSWORD;
const DASHBOARD_SHANU_PASSWORD = process.env.DASHBOARD_SHANU_PASSWORD; // Viewer: Hindi, English, Tamil, Malayalam
const DASHBOARD_HINDI_PASSWORD = process.env.DASHBOARD_HINDI_PASSWORD; // Only Hindi orders
const DASHBOARD_ENGLISH_PASSWORD = process.env.DASHBOARD_ENGLISH_PASSWORD; // Only English orders
const DASHBOARD_TAMIL_PASSWORD = process.env.DASHBOARD_TAMIL_PASSWORD; // Only Tamil orders
const DASHBOARD_TELUGU_PASSWORD = process.env.DASHBOARD_TELUGU_PASSWORD; // Only Telugu orders
const DASHBOARD_KANNADA_PASSWORD = process.env.DASHBOARD_KANNADA_PASSWORD; // Only Kannada orders
const DASHBOARD_MALAYALAM_PASSWORD = process.env.DASHBOARD_MALAYALAM_PASSWORD; // Only Malayalam orders

app.use(express.urlencoded({ extended: true })); // for form data
app.use(express.json()); // for JSON bodies

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
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

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
  if (req.session.loggedIn) return next();
  res.redirect('/login');
}

// Middleware to require admin for updates
function requireAdmin(req, res, next) {
  if (req.session.role && req.session.role === 'admin') return next();
  res.status(403).send('Access denied: Admins only.');
}

// ---------------------------
// HELPER FUNCTION FOR PAGINATION
// ---------------------------
async function fetchAllOrders(shop, accessToken) {
  let orders = [];
  // Use the maximum allowed limit per request (250 is the max for Shopify)
  let url = `https://${shop}/admin/api/2023-04/orders.json?limit=250`;
  
  while (url) {
    const response = await axios.get(url, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    orders = orders.concat(response.data.orders);
    
    // Check for the Link header to see if there is a next page
    const linkHeader = response.headers.link;
    if (linkHeader) {
      url = parseNextLink(linkHeader);
    } else {
      url = null;
    }
  }
  return orders;
}

function parseNextLink(linkHeader) {
  // Example Link header:
  // <https://your-store.myshopify.com/admin/api/2023-04/orders.json?page_info=xyz&limit=250>; rel="next"
  const links = linkHeader.split(',');
  for (let link of links) {
    const [urlPart, relPart] = link.split(';');
    if (relPart && relPart.includes('rel="next"')) {
      return urlPart.trim().slice(1, -1);
    }
  }
  return null;
}

// ---------------------------
// DASHBOARD ROUTE
// ---------------------------
app.get('/dashboard', requireLogin, async (req, res) => {
  const shop = SHOPIFY_SHOP_DOMAIN;
  const accessToken = SHOPIFY_ACCESS_TOKEN;
  
  try {
    let orders = await fetchAllOrders(shop, accessToken);
    
    // If the user is not admin, filter orders by allowed language.
    if (req.session.role !== 'admin') {
      // Normalize allowed languages to lowercase.
      const allowedLanguages = req.session.languages.map(lang => lang.toLowerCase());
      
      orders = orders.filter(order => {
        let orderLanguage = null;
        // Loop through each order's line items to extract language information.
        order.line_items.forEach(item => {
          if (item.properties && item.properties.length > 0) {
            item.properties.forEach(prop => {
              const propName = prop.name.toLowerCase();
              if (propName.includes('language')) {
                // Check if it's a "Form Data" property.
                if (propName.includes('form data')) {
                  // Split lines, trim empty ones.
                  const lines = prop.value.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                  lines.forEach(line => {
                    // If the line starts with "language:" (case-insensitive)
                    if (line.toLowerCase().startsWith('language:')) {
                      orderLanguage = line.split(':')[1].trim().toLowerCase();
                      console.log(`Order ${order.name}: Detected language: ${orderLanguage}`);
                    }
                  });
                } else {
                  orderLanguage = prop.value.trim().toLowerCase();
                  console.log(`Order ${order.name}: Detected language (non-Form Data): ${orderLanguage}`);
                }
              }
            });
          }
        });
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
// FEEDBACK UPDATE ENDPOINT (ADMIN ONLY)
// ---------------------------
app.post('/update-feedback', requireLogin, requireAdmin, (req, res) => {
  // Normally, update your database or Shopify metafields.
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
