import express from 'express'
import unless from 'express-unless'
import bodyParser from 'body-parser'
import cors from 'cors'
import createTestUser from './_test-helpers/create-test-user'
import errorMiddleware from './middleware/error-middleware'
import authorizeMiddleware from './middleware/authorize-middleware'
import 'reflect-metadata';
import { disconnectAllPrismaClients } from './db';
const app = express()
const port = 8080

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('uncaughtException', gracefulShutdown);

async function gracefulShutdown(error?: Error) {
  console.log('Graceful shutdown initiated...');

  if (error) {
    console.error('Shutdown triggered by error:', error);
  }
  try {
    // Disconnect all Prisma clients
    await disconnectAllPrismaClients();

    // Close other connections (e.g., Redis, HTTP server)
    // server.close()
    // redisClient.quit()
    // etc.

    console.log('All connections closed successfully');
    process.exit(error ? 1 : 0);
  } catch (shutdownError) {
    console.error('Error during shutdown:', shutdownError);
    process.exit(1);
  }
}

// createTestUser()
app.get('/', (req, res) => res.send('Hello World!'))
app.use(bodyParser.json())
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
// app.use('/auth', require('./auth/auth.controller'))
app.use('/auth', require('./auth/auth.v2.controller'))

//authentication middleware
app.use(authorizeMiddleware)

// all api routes that need authorize should place here
// api routes
app.use('/user', require('./user/user.controller'))
app.use('/item', require('./item/item.controller'))
app.use('/category', require('./category/category.controller'))
app.use('/supplier', require('./supplier/supplier.controller'))
app.use('/customer', require('./customer/customer.controller'))
app.use('/sales', require('./sales/sales.controller'))
app.use('/stock', require('./stock/stock.controller'))
app.use('/stockCheck', require('./stock/stockcheck.controller'))
app.use('/session', require('./session/session.controller'))
app.use('/menu', require('./menu/menu.controller'))
app.use('/tenant', require('./tenant/tenant.controller'))

//error middleware
app.use(errorMiddleware)

app.listen(port, () => console.log(`Example app listening on port ${port}!`))