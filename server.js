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
const DASHBOARD_SHANU_PASSWORD = process.env.DASHBOARD_SHANU_PASSWORD; // Shanu: special viewer; sees all orders except those with language telugu and kannada.
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
  // Admin login
  if (password === DASHBOARD_ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'admin';
    req.session.languages = null; // Admin sees all orders
    res.redirect('/dashboard');
  }
  // Special viewer: Shanu – sees all orders except those with Telugu or Kannada
  else if (password === DASHBOARD_SHANU_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.shanu = true; // set a flag indicating Shanu's special viewer mode
    res.redirect('/dashboard');
  }
  // Other viewer roles using allowed languages as a whitelist
  else if (password === DASHBOARD_HINDI_PASSWORD) {
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
    
    // For non-admin users, filter orders based on language.
    if (req.session.role !== 'admin') {
      // Special case for Shanu: Show all orders except those with language 'telugu' or 'kannada'.
      if (req.session.shanu) {
        orders = orders.filter(order => {
          let orderLanguage = null;
          for (const item of order.line_items) {
            if (item.properties && item.properties.length > 0) {
              for (const prop of item.properties) {
                const lowerName = prop.name.toLowerCase();
                if (lowerName === 'form data' || lowerName.includes('form data')) {
                  const lines = prop.value.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                  for (const line of lines) {
                    if (line.toLowerCase().startsWith('language:')) {
                      orderLanguage = line.split(':')[1].trim().toLowerCase();
                      break;
                    }
                  }
                  if (orderLanguage) break;
                } else if (lowerName.includes('language')) {
                  orderLanguage = prop.value.trim().toLowerCase();
                  break;
                }
              }
            }
            if (orderLanguage) break;
          }
          // For Shanu: if no language is detected, allow the order.
          if (!orderLanguage) {
            console.log(`Order ${order.name}: No language detected. Allowing order for Shanu.`);
            return true;
          }
          // Allow if language is "mix"
          if (orderLanguage === 'mix') {
            console.log(`Order ${order.name}: Language mix detected. Allowing order for Shanu.`);
            return true;
          }
          // Otherwise, allow the order only if it's not Telugu and not Kannada.
          const isAllowed = orderLanguage !== 'telugu' && orderLanguage !== 'kannada';
          console.log(`Order ${order.name}: Detected language: ${orderLanguage}. Allowed for Shanu: ${isAllowed}`);
          return isAllowed;
        });
      }
      // For other viewer roles, use the allowed languages as a whitelist.
      else {
        const allowedLanguages = req.session.languages.map(lang => lang.toLowerCase());
        orders = orders.filter(order => {
          let orderLanguage = null;
          for (const item of order.line_items) {
            if (item.properties && item.properties.length > 0) {
              for (const prop of item.properties) {
                const lowerName = prop.name.toLowerCase();
                if (lowerName === 'form data' || lowerName.includes('form data')) {
                  const lines = prop.value.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                  for (const line of lines) {
                    if (line.toLowerCase().startsWith('language:')) {
                      orderLanguage = line.split(':')[1].trim().toLowerCase();
                      break;
                    }
                  }
                  if (orderLanguage) break;
                } else if (lowerName.includes('language')) {
                  orderLanguage = prop.value.trim().toLowerCase();
                  break;
                }
              }
            }
            if (orderLanguage) break;
          }
          console.log(`Order ${order.name}: Detected language: ${orderLanguage}`);
          return orderLanguage && allowedLanguages.includes(orderLanguage);
        });
      }
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
