import express from 'express'
import unless from 'express-unless'
import bodyParser from 'body-parser'
import cors from 'cors'
import createTestUser from './_test-helpers/create-test-user'
import errorMiddleware from './middleware/error-middleware'
import authorizeMiddleware from './middleware/authorize-middleware'
const app = express()
const port = 8080

// createTestUser()
app.get('/', (req, res) => res.send('Hello World!'))
app.use(bodyParser.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

// allow cors requests from any origin and with credentials
app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }))


// auth route need to execute before authentication middleware
// because we need to exclude few path like "\login" since login API doesn't require token to authenticate
app.use('/auth', require('./auth/auth.controller')) 

//authentication middleware
app.use(authorizeMiddleware)

// all api routes that need authorize should place here
// api routes
app.use('/user', require('./users/user.controller'))
app.use('/item', require('./items/item.controller'))
app.use('/supplier', require('./suppliers/supplier.controller'))
app.use('/customer', require('./customers/customer.controller'))

//error middleware
app.use(errorMiddleware)

app.listen(port, () => console.log(`Example app listening on port ${port}!`))