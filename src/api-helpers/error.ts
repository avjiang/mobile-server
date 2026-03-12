export interface VersionMismatchDetail {
    itemId: number;
    expectedVersion: number;
    foundVersion: number;
}

export class ResponseError {
    errorType: string
    errorMessage: string
    mismatches?: VersionMismatchDetail[];

    constructor(
        errorType: string,
        errorMessage: string,
        mismatches?: VersionMismatchDetail[]
    ) {
        this.errorType = errorType;
        this.errorMessage = errorMessage;
        this.mismatches = mismatches;
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

export class AuthenticationError extends BaseError { }

export class NotFoundError extends BaseError {
    propertyName: string

    constructor(propertyName: string) {
        super(404, `${propertyName} not found.`)
        this.propertyName = propertyName
    }

}

export class VersionMismatchError extends BaseError {
    public mismatches: VersionMismatchDetail[];

    constructor(message: string, mismatches: VersionMismatchDetail[]) {
        super(409, message);
        this.name = 'VersionMismatchError';
        this.mismatches = mismatches;
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

// Loyalty-specific errors
export class InsufficientPointsError extends BaseError {
    constructor(available: number, requested: number) {
        super(400, `Insufficient loyalty points. Available: ${available}, Requested: ${requested}`);
    }
}

export class TierMismatchError extends BaseError {
    constructor(message: string = 'Loyalty tier discount mismatch') {
        super(400, message);
    }
}

export class SubscriptionExpiredError extends BaseError {
    constructor(message: string = 'Customer subscription is expired or inactive') {
        super(400, message);
    }
}

export class LoyaltyNotEnabledError extends BaseError {
    constructor() {
        super(403, 'Loyalty features are not enabled for this tenant');
    }
}