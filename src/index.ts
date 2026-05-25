import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import compression from 'compression'
import errorMiddleware from './middleware/error-middleware'
import authorizeMiddleware from './middleware/authorize-middleware'
import idempotencyMiddleware from './middleware/idempotency-middleware'
import 'reflect-metadata';
import { disconnectAllPrismaClients, startTenantClientEviction, getTenantClientStats } from './db';
import { initCronJobs } from './cron/cron-manager';
const app = express()
const port = process.env.PORT || 8080;

// Enable gzip compression for all responses
app.use(compression({
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Compression level (1-9, 6 is balanced)
}));

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

// app.options('*', cors())
// allow cors requests from any origin and with credentials
// app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }))

// Use the cors middleware and configure it
app.use(cors({
  origin: '*', // Be careful with this in production, it's better to whitelist specific domains
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization', 'token'],
}));

// auth route need to execute before authentication middleware
// because we need to exclude few path like "\login" since login API doesn't require token to authenticate
const serverStartTime = new Date().toISOString();
app.get('/', (req, res) => res.json({
  version: require('../package.json').version,
  startedAt: serverStartTime,
}))

// Liveness probe for Azure App Service healthCheckPath. Must stay cheap —
// no DB calls — so a transient DB hiccup doesn't trigger an instance restart.
app.get('/health', (req, res) => res.json({
  status: 'ok',
  uptime: process.uptime(),
  tenants: getTenantClientStats().activeTenants,
}))

app.use('/auth', require('./auth/auth.controller'))
app.use('/version', require('./version/version.controller'))

//authentication middleware
app.use(authorizeMiddleware)

// Dedupe retries of the same write (clientIdempotencyKey from Flutter outbox).
// Must run after auth so we know which tenant DB to query.
app.use(idempotencyMiddleware)

// all api routes that need authorize should place here
app.use('/admin', require('./admin/admin.controller'))
app.use('/admin', require('./admin/version/admin-version.controller'))
app.use('/account', require('./account/account.controller'))
app.use('/user', require('./user/user.controller'))
app.use('/item', require('./item/item.controller'))
app.use('/category', require('./category/category.controller'))
app.use('/supplier', require('./supplier/supplier.controller'))
app.use('/customer', require('./customer/customer.controller'))
app.use('/sales', require('./sales/sales.controller'))
app.use('/stock', require('./stock/stock-balance/stock-balance.controller'))
app.use('/stockMovement', require('./stock/stock-movement/stock-movement.controller'))
app.use('/stockReceipt', require('./stock/stock-receipt/stock-receipt.controller'))
app.use('/session', require('./session/session.controller'))
app.use('/menu', require('./menu/menu.controller'))
app.use('/report', require('./report/report.controller'))
app.use('/role', require('./role/role.controller'))
app.use('/permission', require('./permission/permission.controller'))
app.use('/outlet', require('./outlet/outlet.controller'))
app.use('/purchaseOrder', require('./purchase_order/purchase-order.controller'))
app.use('/deliveryOrder', require('./delivery_order/delivery-order.controller'))
app.use('/invoice', require('./invoice/invoice.controller'))
app.use('/invoiceSettlement', require('./invoice_settlement/invoice_settlement.controller'))
app.use('/quotation', require('./quotation/quotation.controller'))
app.use('/pushy', require('./pushy/device.controller'))
app.use('/settings', require('./settings/settings.controller'))
app.use('/warehouses', require('./warehouse/warehouse.controller'))
app.use('/purchaseReturn', require('./purchase_return/purchase-return.controller'))
app.use('/loyalty', require('./loyalty/loyalty.controller'))
app.use('/subscription', require('./subscription-package/subscription-package.controller'))
app.use('/voucher', require('./voucher/voucher.controller'))

// error middleware
app.use(errorMiddleware)

const server = app.listen(port, () => {
  console.log(`Server running on port ${process.env.PORT || 8080}`);
  initCronJobs();
  startTenantClientEviction();
});

server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.name === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use.`);
    process.exit(1); // Exit gracefully
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

async function gracefulShutdown(error?: Error) {
  console.log('Graceful shutdown initiated...');

  if (error) {
    console.error('Shutdown triggered by error:', error?.stack || error);
  }

  try {
    await disconnectAllPrismaClients();
    console.log('Prisma clients disconnected');

    // Close HTTP server
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(error ? 1 : 0);
    });
  } catch (shutdownError) {
    console.error('Error during shutdown:', shutdownError);
    // Ensure server is closed even if Prisma fails
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(1);
    });
  }
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('uncaughtException', gracefulShutdown);
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown(new Error(`Unhandled Rejection: ${reason}`));
});
