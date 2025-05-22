const express = require('express');
const axios = require('axios');
const cookieSession = require('cookie-session');
const path = require('path');
const Redis = require("ioredis");

const app = express();
const PORT = process.env.PORT || 3000;

// Environment Variables – ensure these are correctly set
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'your-store.myshopify.com';

const DASHBOARD_ADMIN_PASSWORD = process.env.DASHBOARD_ADMIN_PASSWORD;
const DASHBOARD_SHANU_PASSWORD = process.env.DASHBOARD_SHANU_PASSWORD;
const DASHBOARD_HINDI_PASSWORD = process.env.DASHBOARD_HINDI_PASSWORD;
const DASHBOARD_ENGLISH_PASSWORD = process.env.DASHBOARD_ENGLISH_PASSWORD;
const DASHBOARD_TAMIL_PASSWORD = process.env.DASHBOARD_TAMIL_PASSWORD;
const DASHBOARD_TELUGU_PASSWORD = process.env.DASHBOARD_TELUGU_PASSWORD;
const DASHBOARD_KANNADA_PASSWORD = process.env.DASHBOARD_KANNADA_PASSWORD;
const DASHBOARD_MALAYALAM_PASSWORD = process.env.DASHBOARD_MALAYALAM_PASSWORD;

// Initialize Redis with Upstash credentials
const redis = new Redis(process.env.UPSTASH_REDIS_URL, {
  password: process.env.UPSTASH_REDIS_TOKEN,
  tls: {} // Required for Upstash
});

// Redis Status Helpers
async function saveStatus(orderId, status) {
  return await redis.set(`status:${orderId}`, JSON.stringify(status));
}
async function getStatus(orderId) {
  const data = await redis.get(`status:${orderId}`);
  return data ? JSON.parse(data) : { done: false };
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieSession({
  name: 'session',
  keys: [process.env.COOKIE_SECRET || 'default-secret'],
  maxAge: 24 * 60 * 60 * 1000 // 1 day
}));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// --------------------
// Login / Logout Routes
// --------------------
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { password } = req.body;

  if (password === DASHBOARD_ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'admin';
    req.session.languages = null;
    return res.redirect('/dashboard');
  } else if (password === DASHBOARD_SHANU_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Hindi', 'English', 'Tamil', 'Malayalam', 'Mix'];
    return res.redirect('/dashboard');
  } else if (password === DASHBOARD_HINDI_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Hindi'];
    return res.redirect('/dashboard');
  } else if (password === DASHBOARD_ENGLISH_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['English'];
    return res.redirect('/dashboard');
  } else if (password === DASHBOARD_TAMIL_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Tamil'];
    return res.redirect('/dashboard');
  } else if (password === DASHBOARD_TELUGU_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Telugu'];
    return res.redirect('/dashboard');
  } else if (password === DASHBOARD_KANNADA_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Kannada'];
    return res.redirect('/dashboard');
  } else if (password === DASHBOARD_MALAYALAM_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Malayalam'];
    return res.redirect('/dashboard');
  } else {
    return res.render('login', { error: 'Invalid password. Please try again.' });
  }
});

app.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  return res.redirect('/login');
}

// --------------------
// Shopify Order Fetch
// --------------------
async function fetchAllOrders(shop, accessToken) {
  let orders = [];
  let url = `https://${shop}/admin/api/2023-04/orders.json?limit=50&fulfillment_status=unfulfilled`;

  // Keep looping until no "next" link is found
  while (url) {
    try {
      const response = await axios.get(url, {
        headers: { 'X-Shopify-Access-Token': accessToken },
        timeout: 10000
      });
      orders = orders.concat(response.data.orders);

      const linkHeader = response.headers.link;
      url = linkHeader ? parseNextLink(linkHeader) : null;

    } catch (err) {
      console.error('Error fetching orders:', err.message);
      break;
    }
  }
  return orders;
}

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  const links = linkHeader.split(',');
  for (let link of links) {
    const [urlPart, relPart] = link.split(';');
    if (relPart && relPart.includes('rel="next"')) {
      return urlPart.trim().slice(1, -1);
    }
  }
  return null;
}

// --------------------
// Dashboard
// --------------------
app.get('/dashboard', requireLogin, async (req, res) => {
  const shop = SHOPIFY_SHOP_DOMAIN;
  const accessToken = SHOPIFY_ACCESS_TOKEN;
  try {
    // Fetch ALL unfulfilled orders
    let orders = await fetchAllOrders(shop, accessToken);

    // For each order, status from Redis
    orders = await Promise.all(
      orders.map(async order => {
        const status = await getStatus(order.id);
        order.status = status;
        return order;
      })
    );

    // If viewer, filter orders by language property
    if (req.session.role === 'viewer' && req.session.languages) {
      const allowedLanguages = req.session.languages.map(lang => lang.toLowerCase());

      orders = orders.filter(order => {
        let foundLanguage = "unknown";
        
        if (order.line_items) {
          // Try to find language in each line item
          for (const item of order.line_items) {
            if (item.properties) {
              // Method 1: Check for standalone "Language" property
              for (const prop of item.properties) {
                if (prop.name.toLowerCase().includes('language') && prop.value) {
                  foundLanguage = prop.value.toLowerCase();
                  break;
                }
              }
              
              // If language not found by Method 1, try Method 2
              if (foundLanguage === "unknown") {
                // Method 2: Check for Form Data property that contains language info
                for (const prop of item.properties) {
                  if (prop.name === "Form Data" && prop.value) {
                    // Extract language from Form Data using regex
                    const languageMatch = prop.value.match(/language:\s*([a-zA-Z]+)/i);
                    if (languageMatch && languageMatch[1]) {
                      foundLanguage = languageMatch[1].toLowerCase();
                      break;
                    }
                  }
                }
              }
            }
            
            // Break out of line items loop if we found a language
            if (foundLanguage !== "unknown") break;
          }
        }
        
        // Check if specific "Mix" language case is allowed
        if (foundLanguage === "unknown" && allowedLanguages.includes("mix")) {
          return true;
        }
        
        return allowedLanguages.includes(foundLanguage);
      });
    }

    res.render('dashboard', {
      orders,
      role: req.session.role
    });
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).send('Error fetching orders');
  }
});

// --------------------
// Status and Notes Endpoints
// --------------------
app.post('/update_status', requireLogin, async (req, res) => {
  const { orderId, done } = req.body;
  if (!orderId) {
    return res.json({ success: false, error: 'Order ID is required.' });
  }
  try {
    const status = { done: Boolean(done) };
    await saveStatus(orderId, status);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating status:', error);
    return res.json({ success: false, error: 'Error updating status.' });
  }
});

// --------------------
// Root Route
// --------------------
app.get('/', (req, res) => {
  if (req.session.loggedIn) {
    return res.redirect('/dashboard');
  } else {
    return res.redirect('/login');
  }
});

app.listen(PORT, () => {
  console.log(`App running on port ${PORT}`);
});
