import { Request } from 'express'

export default interface NetworkRequest<T> extends Request {
    body: T
}