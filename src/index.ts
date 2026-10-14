import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import compression from 'compression'
import errorMiddleware from './middleware/error-middleware'
import authorizeMiddleware from './middleware/authorize-middleware'
import idempotencyMiddleware from './middleware/idempotency-middleware'
import { CLIENT_REF_CAPABILITY_HEADER } from './sales/client-ref'
import 'reflect-metadata';
import { disconnectAllPrismaClients, startTenantClientEviction, getTenantClientStats } from './db';
import { initCronJobs } from './cron/cron-manager';
import { CLOUDFLARE_IP_RANGES } from './constants/cloudflare-ips';
import { liveNotifications } from './live/live-notifications';
const app = express()
const port = process.env.PORT || 8080;

// Trust ONLY Cloudflare edge IPs as proxies, so `req.ip` reflects the real client
// only when traffic genuinely arrived via Cloudflare. Requests hitting the Azure
// origin directly cannot spoof their source — closes the public-endpoint rate-limit
// bypass (security review H-1). The POS API (direct to Azure) is unaffected: for
// those, the peer isn't a trusted proxy so req.ip = the real socket address.
// 'loopback' covers a Cloudflare Tunnel (cloudflared on the same host forwards from
// 127.0.0.1); without it every tunnelled request would share req.ip = 127.0.0.1.
app.set('trust proxy', ['loopback', ...CLOUDFLARE_IP_RANGES]);

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

// Tells the app this server keeps checkout/payment idempotency keys on the rows
// themselves (sales/client-ref.ts), so it may replay those writes past the 24h
// idempotency_record window. Set on every response so the app sees it early.
app.use((_req, res, next) => {
    res.setHeader(CLIENT_REF_CAPABILITY_HEADER, '1')
    next()
})

app.use('/auth', require('./auth/auth.controller'))
app.use('/version', require('./version/version.controller'))
// Public online catalogue — tokenless by design; MUST stay above the auth middleware.
app.use('/public', require('./public/public.controller'))

//authentication middleware
app.use(authorizeMiddleware)

// Admin routes are mounted BEFORE requireOutletAccess so the outlet middleware
// never inspects admin URLs. Admin endpoints carry a global tenant_outlet.id in
// path params which would never match a JWT's tenant-local allowedOutletIds.
// Admin auth gating happens inside authorizeMiddleware (admin role check).
app.use('/admin', require('./admin/admin.controller'))
app.use('/admin', require('./admin/version/admin-version.controller'))

import { requireOutletAccess } from './middleware/outlet-authorization.middleware'
app.use(requireOutletAccess)

// Dedupe retries of the same write (clientIdempotencyKey from Flutter outbox).
// Must run after auth so we know which tenant DB to query.
app.use(idempotencyMiddleware)

// all api routes that need authorize should place here
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
app.use('/device', require('./device/device.controller'))
app.use('/settings', require('./settings/settings.controller'))
app.use('/warehouses', require('./warehouse/warehouse.controller'))
app.use('/purchaseReturn', require('./purchase_return/purchase-return.controller'))
app.use('/loyalty', require('./loyalty/loyalty.controller'))
app.use('/subscription', require('./subscription-package/subscription-package.controller'))
app.use('/voucher', require('./voucher/voucher.controller'))
app.use('/catalogue', require('./catalogue/catalogue.controller'))
app.use('/expenseCategory', require('./expense-category/expense-category.controller'))
app.use('/expense', require('./expense/expense.controller'))
app.use('/expenseRecurringTemplate', require('./expense-recurring-template/expense-recurring-template.controller'))
app.use('/costRate', require('./cost-rate/cost-rate.controller'))

// error middleware
app.use(errorMiddleware)

const onListening = () => {
  console.log(`Server running on ${process.env.HOST || '*'}:${port}`);
  // A standby host (deploy/macmini) shares the prod DB with App Service — the nightly jobs
  // must run on exactly one host, or point expiry etc. would run twice.
  if (process.env.DISABLE_CRONS === 'true') {
    console.log('[Cron] DISABLE_CRONS=true — scheduled jobs not started on this host');
  } else {
    initCronJobs();
  }
  startTenantClientEviction();
};

// HOST pins the bind address (127.0.0.1 behind a Cloudflare Tunnel, so the LAN cannot reach the
// port directly). Unset = Node's default all-interfaces bind, as on App Service.
const server = process.env.HOST
  ? app.listen(Number(port), process.env.HOST, onListening)
  : app.listen(port, onListening);

// Live notifications for desktop apps (WebSocket upgrades on /live/notifications).
liveNotifications.attach(server);

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
    liveNotifications.closeAll();
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
