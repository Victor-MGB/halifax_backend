const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

// IMPORT YOUR MODELS (ADD THESE)
const User = require('./models/User');
const Account = require('./models/Account');
const Transaction = require('./models/Transaction');
const WithdrawalRequest = require('./models/WithdrawalRequest');
const Notification = require('./models/Notification');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173' // Vite default port
  ],
  credentials: true
}));
app.use(express.json());

app.use((req, res, next) => {
  // console.log('Origin:', req.headers.origin);
  next();
});

// Routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/accounts',     require('./routes/accounts'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/withdrawals',  require('./routes/withdrawals'));
app.use('/api/notifications',require('./routes/notifications'));
app.use('/api/admin',        require('./routes/admin'));

app.get('/api/health', (_, res) => res.json({ status: 'OK' }));

// Detailed health check with system status
app.get('/api/health/detailed', async (_, res) => {
  try {
    const startTime = process.uptime();
    
    let dbStatus = 'disconnected';
    let dbLatency = null;
    try {
      const dbStart = Date.now();
      await mongoose.connection.db.admin().ping();
      dbLatency = Date.now() - dbStart;
      dbStatus = 'connected';
    } catch (err) {
      dbStatus = 'error';
    }

    const memoryUsage = process.memoryUsage();
    
    const uptime = {
      seconds: Math.floor(startTime),
      minutes: Math.floor(startTime / 60),
      hours: Math.floor(startTime / 3600),
      days: Math.floor(startTime / 86400),
      formatted: formatUptime(startTime)
    };

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbStatus,
        latency_ms: dbLatency,
        name: mongoose.connection.name || 'unknown'
      },
      server: {
        uptime: uptime,
        memory: {
          heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss_mb: Math.round(memoryUsage.rss / 1024 / 1024)
        },
        node_version: process.version,
        platform: process.platform
      },
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: err.message
    });
  }
});

// Service status endpoint
app.get('/api/health/services', async (_, res) => {
  const services = {
    database: { status: 'checking', type: 'mongodb' },
    jwt: { status: 'checking', type: 'authentication' },
    bcrypt: { status: 'checking', type: 'encryption' }
  };

  try {
    await mongoose.connection.db.admin().ping();
    services.database.status = 'operational';
    services.database.latency_ms = await measureDbLatency();
  } catch {
    services.database.status = 'degraded';
  }

  services.jwt.status = process.env.JWT_SECRET ? 'operational' : 'misconfigured';
  services.bcrypt.status = 'operational';

  const allOperational = Object.values(services).every(s => s.status === 'operational');
  const hasDegraded = Object.values(services).some(s => s.status === 'degraded');

  res.json({
    success: true,
    status: allOperational ? 'operational' : (hasDegraded ? 'degraded' : 'partial_outage'),
    timestamp: new Date().toISOString(),
    services
  });
});

// Stats endpoint - NOW WITH MODELS IMPORTED
app.get('/api/health/stats', async (_, res) => {
  try {
    const [
      userCount,
      accountCount,
      transactionCount,
      withdrawalCount,
      notificationCount
    ] = await Promise.all([
      User.countDocuments(),
      Account.countDocuments(),
      Transaction.countDocuments(),
      WithdrawalRequest.countDocuments(),
      Notification.countDocuments()
    ]);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      platform: {
        name: 'Nexus Private Bank',
        version: '1.0.0'
      },
      statistics: {
        total_users: userCount,
        total_accounts: accountCount,
        total_transactions: transactionCount,
        active_withdrawals: withdrawalCount,
        total_notifications: notificationCount
      },
      rates: {
        transaction_rate_per_second: await getTransactionRate(),
        active_sessions: await getActiveSessions()
      }
    });
  } catch (err) {
    console.error('Health stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Database status endpoint
app.get('/api/health/database', async (_, res) => {
  try {
    const db = mongoose.connection;
    const collections = await db.db.listCollections().toArray();
    
    const collectionStats = {};
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      collectionStats[collection.name] = count;
    }

    res.json({
      success: true,
      status: db.readyState === 1 ? 'connected' : 'disconnected',
      name: db.name,
      host: db.host,
      port: db.port,
      collections_count: collections.length,
      collections: collectionStats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Readiness probe
app.get('/api/health/ready', async (_, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: 'not ready', reason: 'database disconnected' });
  }
  res.json({ status: 'ready' });
});

// Liveness probe
app.get('/api/health/live', (_, res) => {
  res.json({ status: 'alive' });
});

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

async function measureDbLatency() {
  const start = Date.now();
  await mongoose.connection.db.admin().ping();
  return Date.now() - start;
}

async function getTransactionRate() {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const count = await Transaction.countDocuments({ createdAt: { $gte: oneHourAgo } });
    return Number((count / 3600).toFixed(2));
  } catch (err) {
    return 0;
  }
}

async function getActiveSessions() {
  return 0;
}


const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => { 
    console.log(' MongoDB connected'); 
    app.listen(PORT, () => console.log(` Server running on port ${PORT}`)); 
  })
  .catch(err => { 
    console.error(' MongoDB connection error:', err); 
    process.exit(1); 
  });

module.exports = app;