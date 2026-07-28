export interface VersionMismatchDetail {
    itemId: number;
    expectedVersion: number;
    foundVersion: number;
}

// Machine-readable identifiers for errors the app translates. `errorMessage`
// stays English and remains the fallback — a client that does not know the code
// (older APK, new code we haven't translated yet) still shows something useful.
// Every code here MUST have a matching `error_*` key in app_en.arb + app_id.arb.
// Only tag errors a merchant can actually hit and act on. Payload/contract
// guards ("purchaseOrders must be a non-empty array", "Valid version number
// must be provided") stay untagged on purpose — they fire only when the client
// sends something malformed, and an English message in a bug report matches the
// code. Codes are grouped by RULE, not by message: one code + an `entity` param
// covers "Supplier with ID 5 does not exist" and "Items with IDs 3, 7 …" alike.
export enum ErrorCode {
    // -- Generic document rules (entity-parameterised) ----------------------
    /** A referenced record doesn't exist. params: entity, ids */
    ReferenceNotFound = 'REFERENCE_NOT_FOUND',
    /** Document number(s) already taken. params: entity, numbers */
    DocumentNumberDuplicate = 'DOCUMENT_NUMBER_DUPLICATE',
    /** Action rejected because the document is cancelled. params: entity */
    DocumentAlreadyCancelled = 'DOCUMENT_ALREADY_CANCELLED',
    /** Edit rejected because the document is cancelled. params: entity */
    DocumentCancelledNotEditable = 'DOCUMENT_CANCELLED_NOT_EDITABLE',
    /** Delete blocked by downstream records. params: entity, dependents */
    DeleteBlockedHasDependents = 'DELETE_BLOCKED_HAS_DEPENDENTS',

    // -- Stock -------------------------------------------------------------
    /** Purchase return exceeds what is still on hand. params: item, available, requested */
    StockInsufficientReturn = 'STOCK_INSUFFICIENT_RETURN',
    /** No StockBalance row for the item being returned. params: item */
    StockBalanceMissingReturn = 'STOCK_BALANCE_MISSING_RETURN',
    /** Receipt layer too small to absorb the return. params: item, detail */
    StockReceiptInsufficient = 'STOCK_RECEIPT_INSUFFICIENT',
    /** Item has variants; the caller must say which. params: item */
    VariantRequired = 'VARIANT_REQUIRED',
    /** Item has no variants but a variant was supplied. params: item */
    VariantNotSupported = 'VARIANT_NOT_SUPPORTED',
    /** Override quantity was negative. */
    OverrideQuantityNegative = 'OVERRIDE_QUANTITY_NEGATIVE',

    // -- Purchase return ---------------------------------------------------
    /** Return reason not in the allowed set. params: reason, validReasons */
    ReturnReasonInvalid = 'RETURN_REASON_INVALID',
    /** Reason OTHER requires a remark. */
    ReturnReasonRemarkRequired = 'RETURN_REASON_REMARK_REQUIRED',
    /** Cumulative returns would exceed the invoiced quantity. params: detail */
    ReturnQuantityExceeds = 'RETURN_QUANTITY_EXCEEDS',
    /** Only PAID invoices can be returned against. params: invoiceId */
    InvoiceNotSettledForReturn = 'INVOICE_NOT_SETTLED_FOR_RETURN',
    /** Invoice has no delivery orders to return from. params: invoiceId */
    NoDeliveryOrdersForInvoice = 'NO_DELIVERY_ORDERS_FOR_INVOICE',

    // -- Payments / settlement --------------------------------------------
    /** Payment larger than what is still owed. params: outstanding */
    PaymentExceedsOutstanding = 'PAYMENT_EXCEEDS_OUTSTANDING',
    /** Payment must be > 0. */
    PaymentAmountNotPositive = 'PAYMENT_AMOUNT_NOT_POSITIVE',
    /** Transfer fee must be >= 0. */
    TransferFeeNegative = 'TRANSFER_FEE_NEGATIVE',
    /** Nothing left to pay. */
    SettlementAlreadyPaid = 'SETTLEMENT_ALREADY_PAID',
    /** Rounding write-off above the allowed cap. params: outstanding, limit */
    WriteOffLimitExceeded = 'WRITE_OFF_LIMIT_EXCEEDED',
    /** Invoices already attached to a settlement. params: ids */
    InvoicesAlreadySettled = 'INVOICES_ALREADY_SETTLED',
    /** Invoices missing or not settleable. params: ids */
    InvoicesNotEligible = 'INVOICES_NOT_ELIGIBLE',
    /** Invoice doesn't belong to this settlement. */
    InvoiceNotInSettlement = 'INVOICE_NOT_IN_SETTLEMENT',

    // -- Down payment ------------------------------------------------------
    /** DP must be > 0. */
    DownPaymentNotPositive = 'DOWN_PAYMENT_NOT_POSITIVE',
    /** DP would exceed the PO total. params: max */
    DownPaymentExceedsTotal = 'DOWN_PAYMENT_EXCEEDS_TOTAL',
    /** DP reduced below what invoices already drew. params: drawn */
    DownPaymentBelowDrawn = 'DOWN_PAYMENT_BELOW_DRAWN',
    /** DP delete would drop below what invoices already drew. params: drawn */
    DownPaymentDeleteBelowDrawn = 'DOWN_PAYMENT_DELETE_BELOW_DRAWN',

    // -- Delivery order / invoice -----------------------------------------
    /** DOs missing or already invoiced. params: ids */
    DeliveryOrdersNotEligible = 'DELIVERY_ORDERS_NOT_ELIGIBLE',
}

/**
 * Stable keys for the noun in an entity-parameterised message. The client maps
 * these onto localized nouns (`error_entity_supplier` → "Pemasok"), so never
 * send a display string as `entity`.
 */
export enum ErrorEntity {
    Supplier = 'SUPPLIER',
    Item = 'ITEM',
    Outlet = 'OUTLET',
    Warehouse = 'WAREHOUSE',
    Customer = 'CUSTOMER',
    Quotation = 'QUOTATION',
    PurchaseOrder = 'PURCHASE_ORDER',
    DeliveryOrder = 'DELIVERY_ORDER',
    Invoice = 'INVOICE',
    InvoiceSettlement = 'INVOICE_SETTLEMENT',
    PurchaseReturn = 'PURCHASE_RETURN',
    DownPayment = 'DOWN_PAYMENT',
}

/** Placeholder values for an ErrorCode's message. Strings only — the client formats. */
export type ErrorParams = Record<string, string>;

export class ResponseError {
    errorType: string
    errorMessage: string
    mismatches?: VersionMismatchDetail[];
    errorCode?: string;
    params?: ErrorParams;

    constructor(
        errorType: string,
        errorMessage: string,
        mismatches?: VersionMismatchDetail[],
        errorCode?: string,
        params?: ErrorParams
    ) {
        this.errorType = errorType;
        this.errorMessage = errorMessage;
        this.mismatches = mismatches;
        this.errorCode = errorCode;
        this.params = params;
    }
}

export class BaseError extends Error {
    statusCode: number;
    /** Set to let the client render a translated message instead of `message`. */
    errorCode?: ErrorCode;
    params?: ErrorParams;

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

// Explicit `name` (BaseError otherwise reports "Function") so validation
// failures are greppable in the App Service log as "RequestValidateError: ..."
// instead of the anonymous "Function: ...".
export class RequestValidateError extends BaseError {
    constructor(message: string, errorCode?: ErrorCode, params?: ErrorParams) {
        super(400, message)
        this.name = 'RequestValidateError'
        this.errorCode = errorCode
        this.params = params
    }
}

export class BusinessLogicError extends BaseError {
    constructor(message: string) {
        super(400, message)
        this.name = 'BusinessLogicError'
    }
}

// Catalogue per-tenant storage cap exceeded. Distinct `name` (BaseError otherwise
// reports "Function") so the client can recognise it and show a specific,
// localized "not enough space" message instead of a generic upload error.
export class CatalogueStorageLimitError extends BaseError {
    constructor(message: string) {
        super(400, message)
        this.name = 'CatalogueStorageLimitError'
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