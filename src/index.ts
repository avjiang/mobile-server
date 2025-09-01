import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import errorMiddleware from './middleware/error-middleware'
import authorizeMiddleware from './middleware/authorize-middleware'
import 'reflect-metadata';
import { disconnectAllPrismaClients } from './db';
const app = express()
const port = process.env.PORT || 8080;

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
app.get('/', (req, res) => res.send('Hello World!'))
app.use('/auth', require('./auth/auth.controller'))

//authentication middleware
app.use(authorizeMiddleware)

// all api routes that need authorize should place here
app.use('/admin', require('./admin/admin.controller'))
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
app.use('/device', require('./device/device.controller'))
app.use('/role', require('./role/role.controller'))
app.use('/permission', require('./permission/permission.controller'))
app.use('/outlet', require('./outlet/outlet.controller'))
app.use('/purchaseOrder', require('./purchase_order/purchase-order.controller'))
app.use('/deliveryOrder', require('./delivery_order/delivery-order.controller'))
app.use('/invoice', require('./invoice/invoice.controller'))
app.use('/invoiceSettlement', require('./invoice_settlement/invoice_settlement.controller'))

// error middleware
app.use(errorMiddleware)

const server = app.listen(port, () => {
  console.log(`Server running on port ${process.env.PORT || 8080}`);
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
