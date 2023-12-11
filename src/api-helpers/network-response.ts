import { BaseError, ResponseError } from './error'

export default class NetworkResponse<T> {
    success: boolean
    data?: T
    error?: ResponseError

    constructor(success: boolean, data: T)
    constructor(success: boolean, error: ResponseError)
    constructor(isSuccess: boolean, dataOrError: T | ResponseError) {
        this.success = isSuccess
        if (dataOrError instanceof ResponseError) {
            this.error = dataOrError as ResponseError
        }
        else {
            this.data = dataOrError as T
        }
        // if (!error) {
        //     this.success = success,
        //     this.data = data
        // }
        // else {
        //     this.success = success,
        //     this.errorMessage = errorMessage,
        //     this.error = error
        // }
    }
}