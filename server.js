const express = require('express');
const axios = require('axios');
const cookieSession = require('cookie-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment Variables
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'your-store.myshopify.com';
const FORWARDING_ADDRESS = process.env.FORWARDING_ADDRESS;

const DASHBOARD_ADMIN_PASSWORD = process.env.DASHBOARD_ADMIN_PASSWORD;
const DASHBOARD_SHANU_PASSWORD = process.env.DASHBOARD_SHANU_PASSWORD;
const DASHBOARD_HINDI_PASSWORD = process.env.DASHBOARD_HINDI_PASSWORD;
const DASHBOARD_ENGLISH_PASSWORD = process.env.DASHBOARD_ENGLISH_PASSWORD;
const DASHBOARD_TAMIL_PASSWORD = process.env.DASHBOARD_TAMIL_PASSWORD;
const DASHBOARD_TELUGU_PASSWORD = process.env.DASHBOARD_TELUGU_PASSWORD;
const DASHBOARD_KANNADA_PASSWORD = process.env.DASHBOARD_KANNADA_PASSWORD;
const DASHBOARD_MALAYALAM_PASSWORD = process.env.DASHBOARD_MALAYALAM_PASSWORD;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cookieSession({
  name: 'session',
  keys: [process.env.COOKIE_SECRET || 'default-secret'],
  maxAge: 24 * 60 * 60 * 1000, // 1 day
}));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// ---------------------------
// LOGIN ROUTES
// ---------------------------
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { password } = req.body;

  if (password === DASHBOARD_ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'admin';
    req.session.languages = null;
    res.redirect('/dashboard');
  } else if (password === DASHBOARD_SHANU_PASSWORD) {
    req.session.loggedIn = true;
    req.session.role = 'viewer';
    req.session.languages = ['Hindi', 'English', 'Tamil', 'Malayalam', 'Mix'];
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

// ---------------------------
// MIDDLEWARE
// ---------------------------
function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session.role === 'admin') return next();
  res.status(403).send('Access denied: Admins only.');
}

// ---------------------------
// HELPER: FETCH ALL ORDERS
// ---------------------------
async function fetchAllOrders(shop, accessToken) {
  let orders = [];
  let url = `https://${shop}/admin/api/2023-04/orders.json?limit=250`;

  while (url) {
    try {
      const response = await axios.get(url, {
        headers: { 'X-Shopify-Access-Token': accessToken }
      });
      orders = orders.concat(response.data.orders);

      const linkHeader = response.headers.link;
      if (linkHeader) {
        url = parseNextLink(linkHeader);
      } else {
        url = null;
      }
    } catch (err) {
      console.error('Error fetching orders:', err.message);
      break;
    }
  }
  return orders;
}

function parseNextLink(linkHeader) {
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
// HELPER: FETCH ORDER EVENTS
// ---------------------------
async function fetchOrderEvents(orderId, shop, accessToken) {
  const url = `https://${shop}/admin/api/2023-04/orders/${orderId}/events.json`;
  try {
    const response = await axios.get(url, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });
    return response.data.events;
  } catch (err) {
    console.error(`Error fetching events for order ${orderId}:`, err.message);
    return [];
  }
}

// ---------------------------
// DASHBOARD ROUTE (UPDATED WITH TIMELINE EVENTS)
// ---------------------------
app.get('/dashboard', requireLogin, async (req, res) => {
  const shop = SHOPIFY_SHOP_DOMAIN;
  const accessToken = SHOPIFY_ACCESS_TOKEN;

  try {
    let orders = await fetchAllOrders(shop, accessToken);

    // Filter orders based on role/language as before
    if (req.session.role !== 'admin') {
      const allowedLanguages = req.session.languages?.map(lang => lang.toLowerCase()) || [];
      let filteredOrders = [];
      let noLanguageUnfulfilledOrders = [];

      for (const order of orders) {
        let orderLanguage = null;
        let foundLanguage = false;

        for (const item of order.line_items) {
          if (item.properties && item.properties.length > 0) {
            for (const prop of item.properties) {
              if (prop.name.toLowerCase() === 'language') {
                orderLanguage = prop.value.trim().toLowerCase();
                foundLanguage = true;
                break;
              }
              if (prop.name.toLowerCase().includes('form data')) {
                const lines = prop.value.split('\n').map(line => line.trim());
                for (const line of lines) {
                  if (line.toLowerCase().startsWith('language:')) {
                    orderLanguage = line.split(':')[1].trim().toLowerCase();
                    foundLanguage = true;
                    break;
                  }
                }
              }
              if (foundLanguage) break;
            }
          }
          if (foundLanguage) break;
        }

        const isShanu = allowedLanguages.includes('mix');
        if (isShanu) {
          if (!orderLanguage && order.fulfillment_status !== 'fulfilled') {
            noLanguageUnfulfilledOrders.push(order);
          } else if (orderLanguage && allowedLanguages.includes(orderLanguage)) {
            filteredOrders.push(order);
          }
        } else {
          if (orderLanguage && allowedLanguages.includes(orderLanguage)) {
            filteredOrders.push(order);
          }
        }
      }
      orders = filteredOrders.concat(noLanguageUnfulfilledOrders);
    }

    // Fetch timeline events for each order (this might be slow if there are many orders)
    for (const order of orders) {
      const events = await fetchOrderEvents(order.id, shop, accessToken);
      // Filter events to only include timeline comments (e.g., events with verb "comment")
      order.timelineComments = events.filter(event => event.verb === 'comment');
    }

    res.render('dashboard', { orders, role: req.session.role });
  } catch (error) {
    console.error('Error fetching orders:', error.response?.data || error.message);
    res.status(500).send('Error fetching orders');
  }
});

// ---------------------------
// ADMIN-ONLY UPDATE ENDPOINT
// ---------------------------
app.post('/update-feedback', requireLogin, requireAdmin, (req, res) => {
  // Normally, update your database or Shopify metafields.
  res.json({ status: 'success' });
});

// ---------------------------
// ROOT ROUTE
// ---------------------------
app.get('/', (req, res) => {
  if (req.session.loggedIn) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// ---------------------------
// START SERVER
// ---------------------------
app.listen(PORT, () => {
  console.log(`App running on port ${PORT}`);
});
