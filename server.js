// ─── Load env first ──────────────────────────────
require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
const connectDB    = require('./config/db');

// ─── Connect Database ─────────────────────────────
connectDB();

const app = express();

// ─── Security Middleware ──────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));

// Rate limiting — 100 requests per 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// Stricter limit on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Core Middleware ──────────────────────────────
app.use(cors({
  origin: function(origin, callback) {
    // Allow these origins
    const allowed = [
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'http://127.0.0.1:3000',
      'http://localhost:3000',
      'http://127.0.0.1:5000',
      'http://localhost:5000',
    ];
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: Origin not allowed → ' + origin));
    }
  },
  credentials:    true,
  methods:        ['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type','Authorization','Cookie'],
  exposedHeaders: ['Set-Cookie'],
}));

// Handle preflight requests for ALL routes
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Static Files ─────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ─── API Routes ───────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/cart',     require('./routes/cart'));

// ─── Health Check ─────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'JEEVA API is running ✅',
    env:     process.env.NODE_ENV,
    time:    new Date().toISOString(),
  });
});

// ─── Serve Frontend (production) ──────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
  });
}

// ─── 404 Handler ──────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ─── Global Error Handler ─────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status  = err.statusCode || 500;
  const message = err.message    || 'Internal Server Error';
  res.status(status).json({ success: false, message });
});

// ─── Start Server ─────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 JEEVA Server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API Health:  http://localhost:${PORT}/api/health\n`);
});
