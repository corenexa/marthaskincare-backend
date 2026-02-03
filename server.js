const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();
const mongoose = require('mongoose');

const authRoutes = require('./src/routes/auth');
const usersRoutes = require('./src/routes/users');
const productsRoutes = require('./src/routes/products');
const { startSessionCleanup } = require('./src/utils/sessionCleanup');
const customersRoutes = require('./src/routes/customers');
const employeesRoutes = require('./src/routes/employees');
const salesRoutes = require('./src/routes/sales');
const notificationsRoutes = require('./src/routes/notifications');
const ordersRoutes = require('./src/routes/orders');
const stockRoutes = require('./src/routes/stock');
const supplierRoute = require('./src/routes/suppliers');
const salaryRoutes = require('./src/routes/salary');
const expenseRoute = require('./src/routes/expense');
const {
  router: storefrontRoutes,
  listStorefrontProducts,
  getStorefrontProductById,
} = require('./src/routes/storefront');
const { startNotificationChecker } = require('./src/utils/notificationScheduler');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const isCrossDomain = isProduction && process.env.FRONTEND_URL && 
  !process.env.FRONTEND_URL.includes('localhost');

const frontendUrl = process.env.FRONTEND_URL || '';
const isLocalFrontend = !frontendUrl || /(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(frontendUrl);
const allowInsecureCookies = process.env.ALLOW_INSECURE_COOKIES === 'true';
const shouldUseSecureCookies = isProduction && !isLocalFrontend && !allowInsecureCookies;

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'dev_session_secret_change_me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy',
    touchAfter: 24 * 3600,
    ttl: 7 * 24 * 60 * 60,
  }),
  cookie: {
    secure: shouldUseSecureCookies,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: isCrossDomain && shouldUseSecureCookies ? 'none' : 'lax'
  },
  name: 'pharmacy.sid'
};

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const defaultCorsOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  'https://fantyfresh.com',
  'https://www.fantyfresh.com',
  'https://adminfanty.vercel.app',
];

function buildCorsOrigins() {
  const envOrigins = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGINS;
  if (!envOrigins) return defaultCorsOrigins;

  const parsed = envOrigins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (parsed.length === 0) {
    return defaultCorsOrigins;
  }

  return parsed.length === 1 ? parsed[0] : parsed;
}

const corsOrigin = buildCorsOrigins();

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(morgan('dev'));
app.use(session(sessionConfig));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.get('/api/products', listStorefrontProducts);
app.get('/api/products/:id', getStorefrontProductById);
app.use('/api/products', productsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/supplier', supplierRoute);
app.use('/api/salaries', salaryRoutes);
app.use('/api/expense', expenseRoute);
app.use('/api/storefront', storefrontRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'pharmacy-backend' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 4000;

// ✅ Added email index cleanup
async function cleanupUserIndexes() {
  try {
    const User = require("./src/models/user").User;
    const indexes = await User.collection.getIndexes();

    if (indexes.email_1) {
      console.log("⚠️ Removing leftover MongoDB index: email_1");
      await User.collection.dropIndex("email_1");
      console.log("✅ Removed email_1 index successfully");
    }
  } catch (err) {
    console.log("Index cleanup skipped:", err.message);
  }
}

async function start() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Automatically remove old email index
    await cleanupUserIndexes();

    startSessionCleanup();
    const checkIntervalMinutes = parseInt(process.env.NOTIFICATION_CHECK_INTERVAL_MINUTES) || 60;
    startNotificationChecker(checkIntervalMinutes);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Session-based authentication enabled');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();