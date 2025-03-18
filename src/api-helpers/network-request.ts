import { Request } from 'express'
import { AuthRequest } from '../middleware/auth-request'

export default interface NetworkRequest<T> extends AuthRequest {
    body: T
}