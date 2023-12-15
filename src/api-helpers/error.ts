export class ResponseError {
    errorType: string
    errorMessage: string

    constructor(errorType: string, errorMessage: string) {
        this.errorType = errorType
        this.errorMessage = errorMessage
    }
}

export class BaseError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message)

        Object.setPrototypeOf(this, new.target.prototype);
        this.name = Error.constructor.name;
        this.statusCode = statusCode;
        Error.captureStackTrace(this);
    }
}

export class AuthenticationError extends BaseError {}

export class NotFoundError extends BaseError {
    propertyName: string

    constructor(propertyName: string) {
        super(404, `${propertyName} not found.`)
        this.propertyName = propertyName
    }

}

export class RequestValidateError extends BaseError {
    constructor(message: string) {
        super(400, message)
    }
}

export class BusinessLogicError extends BaseError {
    constructor(message: string) {
        super(400, message)
    }
}