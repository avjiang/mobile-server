import express, { NextFunction, Request, Response } from "express"
import validator from "validator"
import service from "./sales.service"
import photoService from "./sales-photo.service"
import { createReceiptUploadTicket } from "../catalogue/catalogue-storage.service"
import NetworkRequest from "../api-helpers/network-request"
import { RequestValidateError } from "../api-helpers/error"
import { sendResponse } from "../api-helpers/network"
import { SalesAnalyticResponseBody } from "./sales.response"
import { CalculateSalesDto, CompleteNewSalesRequest, CompleteSalesRequest, SalesCreationRequest, SalesRequestBody, UpdateSalesDetailsRequest } from "./sales.request"
import { validateDates } from "../helpers/dateHelper"
import { Payment, Prisma, Sales } from "../../prisma/client/generated/client"
import { AuthRequest } from "src/middleware/auth-request"
import { SyncRequest } from "src/item/item.request"
import { requirePermission } from "../middleware/require-permission.middleware"
import { PERMISSION } from "../permission/permission-names"

const router = express.Router()

// Hard ceiling on any client-supplied `take`, so a client bug or a hostile caller
// can't request an unbounded page. Applied to every paginated sales read below.
const MAX_SALES_PAGE_SIZE = 500

interface SelectedSales {
    id: number;
    businessDate: Date;
    salesType: string;
    customerId: number | null;
    totalAmount: number;
    paidAmount: number;
    paymentMethod: string;
    status: string;
    remark: string;
    customerName: string;
    totalItems: number;
}

const getAll = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { outletId, skip, take, lastSyncTimestamp } = req.query;

    // Validate outletId
    if (!outletId || !validator.isNumeric(outletId as string)) {
        throw new RequestValidateError('Valid outletId is required');
    }

    const skipNum = skip && validator.isNumeric(skip as string) ? parseInt(skip as string) : 0;
    const takeNum = Math.min(
        take && validator.isNumeric(take as string) ? parseInt(take as string) : 100,
        MAX_SALES_PAGE_SIZE,
    );

    const syncRequest = {
        outletId: outletId as string,
        skip: skipNum,
        take: takeNum,
        lastSyncTimestamp: lastSyncTimestamp as string
    };

    service.getAll(req.user.databaseName, syncRequest)
        .then(({ data, total, serverTimestamp }) => {
            sendResponse(res, { data, total, serverTimestamp });
        })
        .catch(next);
}

const getAllByDateRange = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { outletId, skip, take, lastSyncTimestamp, startDate, endDate } = req.query;

    // Validate outletId
    if (!outletId || !validator.isNumeric(outletId as string)) {
        throw new RequestValidateError('Valid outletId is required');
    }
    // Validate date parameters
    if (!startDate || !endDate) {
        throw new RequestValidateError('Both startDate and endDate are required');
    }
    try {
        // Basic date format validation
        const parsedStartDate = new Date(startDate as string);
        const parsedEndDate = new Date(endDate as string);

        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            throw new Error('Invalid date format');
        }
        if (parsedEndDate < parsedStartDate) {
            throw new Error('endDate cannot be before startDate');
        }
    } catch (error) {
        throw new RequestValidateError(`Date validation error`);
    }
    const skipNum = skip && validator.isNumeric(skip as string) ? parseInt(skip as string) : 0;
    const takeNum = Math.min(
        take && validator.isNumeric(take as string) ? parseInt(take as string) : 100,
        MAX_SALES_PAGE_SIZE,
    );
    const dateRangeRequest = {
        outletId: outletId as string,
        skip: skipNum,
        take: takeNum,
        lastSyncTimestamp: lastSyncTimestamp as string,
        startDate: startDate as string,
        endDate: endDate as string
    };
    service.getByDateRange(req.user.databaseName, dateRangeRequest)
        .then(({ data, total, serverTimestamp }) => {
            sendResponse(res, { data, total, serverTimestamp });
        })
        .catch(next);
}

const getById = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }
    const itemId: number = parseInt(req.params.id)
    service.getById(req.user.databaseName, itemId)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next)
}

// Laundry pickup: fetch a sale by its client-minted orderRef (QR scan key).
const getByRef = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }
    const orderRef = (req.params.orderRef ?? '').trim()
    if (!orderRef) {
        throw new RequestValidateError('orderRef is required')
    }
    service.getByRef(req.user.databaseName, orderRef)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next)
}

// Laundry pickup: mark an order collected (+ status→Completed if fully paid).
const collect = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }
    const orderRef = (req.params.orderRef ?? '').trim()
    if (!orderRef) {
        throw new RequestValidateError('orderRef is required')
    }
    service.collect(req.user.databaseName, orderRef)
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next)
}

// Laundry photos: mint a pre-signed R2 PUT URL for photo #index of an order.
const photoUploadUrl = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }
    const orderRef = (req.body?.orderRef ?? '').toString().trim()
    const index = parseInt((req.body?.index ?? '0').toString())
    const contentType = (req.body?.contentType ?? 'image/webp').toString()
    if (!orderRef) {
        throw new RequestValidateError('orderRef is required')
    }
    photoService.mintUploadTicket(req.user.tenantId, orderRef, isNaN(index) ? 0 : index, contentType)
        .then((ticket) => sendResponse(res, ticket))
        .catch(next)
}

// Laundry photos: persist a photo URL after the client's direct R2 PUT.
const registerPhoto = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }
    const orderRef = (req.body?.orderRef ?? '').toString().trim()
    const photoUrl = (req.body?.photoUrl ?? '').toString().trim()
    const salesId = req.body?.salesId ? parseInt(req.body.salesId.toString()) : undefined
    if (!orderRef || !photoUrl) {
        throw new RequestValidateError('orderRef and photoUrl are required')
    }
    photoService.register(req.user.databaseName, { orderRef, salesId, photoUrl })
        .then((photo) => sendResponse(res, photo))
        .catch(next)
}

// Laundry photos: list an order's photos.
const listPhotos = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }
    const orderRef = (req.params.orderRef ?? '').trim()
    if (!orderRef) {
        throw new RequestValidateError('orderRef is required')
    }
    photoService.listByRef(req.user.databaseName, orderRef)
        .then((photos) => sendResponse(res, photos))
        .catch(next)
}

// Digital receipt: mint a pre-signed R2 PUT URL for an order's receipt PDF.
// ONE stable object per order (receipts/<tenantId>/<orderRef>.pdf) — the pickup
// receipt overwrites the payment receipt in place, so the shared WhatsApp link
// always resolves to the latest state. The client caches the returned publicUrl
// and only re-uploads when the sale changes.
const receiptUploadUrl = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated')
    }
    const orderRef = (req.body?.orderRef ?? '').toString().trim()
    const contentType = (req.body?.contentType ?? 'application/pdf').toString()
    if (!orderRef) {
        throw new RequestValidateError('orderRef is required')
    }
    createReceiptUploadTicket({ tenantId: req.user.tenantId, orderRef, contentType })
        .then((ticket) => sendResponse(res, ticket))
        .catch(next)
}

// const create = (req: NetworkRequest<SalesCreationRequest>, res: Response, next: NextFunction) => {
//     if (!req.user) {
//         throw new RequestValidateError('User not authenticated');
//     }
//     if (Object.keys(req.body).length === 0) {
//         throw new RequestValidateError('Request body is empty')
//     }

//     const salesBody = req.body
//     if (!salesBody) {
//         throw new RequestValidateError('Create failed: data missing')
//     }

//     const sales = salesBody.sales
//     if (!sales) {
//         throw new RequestValidateError('Create failed: sales data missing')
//     }

//     service.create(req.user.databaseName, salesBody)
//         .then((sales: Sales) => sendResponse(res, sales))
//         .catch(next)
// }

const completeNewSales = (req: NetworkRequest<CompleteNewSalesRequest>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }
    const requestBody = req.body
    if (!requestBody) {
        throw new RequestValidateError('Create failed: data missing')
    }
    const sales = requestBody.sales
    if (!sales) {
        throw new RequestValidateError('Create failed: sales data missing')
    }
    const payments = requestBody.payments
    service.completeNewSales(
        req.user.databaseName,
        req.user.tenantId,
        { userId: req.user.userId, username: req.user.username, loyaltyTier: req.user.loyaltyTier, permissions: req.user.permissions },
        sales,
        payments
    )
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next)
}

// const completeSales = (req: NetworkRequest<CompleteSalesRequest>, res: Response, next: NextFunction) => {
//     if (!req.user) {
//         throw new RequestValidateError('User not authenticated');
//     }
//     if (Object.keys(req.body).length === 0) {
//         throw new RequestValidateError('Request body is empty')
//     }

//     const requestBody = req.body
//     if (!requestBody) {
//         throw new RequestValidateError('Data missing')
//     }

//     const salesId = requestBody.salesId
//     if (salesId == 0) {
//         throw new RequestValidateError('sales ID cannot be 0')
//     }

//     const payments = requestBody.payments
//     if (payments.length > 0) {
//         for (const payment of payments) {
//             if (payment.salesId != salesId) {
//                 throw new RequestValidateError('payment has different sales ID')
//             }
//         }
//     }

//     service.completeSales(req.user.databaseName, salesId, payments)
//         .then((sales: Sales) => sendResponse(res, sales))
//         .catch(next)
// }

const calculateSales = (req: NetworkRequest<CalculateSalesDto>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const requestBody = req.body
    if (!requestBody) {
        throw new RequestValidateError('Data missing')
    }

    service.calculateSales(req.user.databaseName, requestBody)
        .then((sales: CalculateSalesDto) => sendResponse(res, sales))
        .catch(next)
}

const update = (req: NetworkRequest<SalesRequestBody>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty')
    }

    const salesBody = req.body

    if (!salesBody) {
        throw new RequestValidateError('Update failed: data missing')
    }

    if (!salesBody.sales.id) {
        throw new RequestValidateError('Update failed: [id] not found')
    }

    service.update(req.user.databaseName, salesBody)
        .then(() => sendResponse(res, "Successfully updated"))
        .catch(next)
}

const remove = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect')
    }

    const salesId: number = parseInt(req.params.id)
    service.remove(req.user.databaseName, salesId)
        .then(() => sendResponse(res, "Successfully deleted"))
        .catch(next)
}

const getTotalSalesData = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { sessionID } = req.query
    const sessionIdNum = typeof sessionID === 'string' && validator.isNumeric(sessionID) ? parseInt(sessionID) : undefined
    if (sessionIdNum === undefined) {
        throw new RequestValidateError('sessionID is required and must be a number')
    }
    service.getTotalSalesData(req.user.databaseName, sessionIdNum, req.user.loyaltyTier)
        .then((salesData) => sendResponse(res, salesData))
        .catch(next)
}

const getRevenueTrend = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { outletId, days, utcOffsetMinutes } = req.query
    const outletIdNum = typeof outletId === 'string' && validator.isNumeric(outletId) ? parseInt(outletId) : undefined
    if (outletIdNum === undefined) {
        throw new RequestValidateError('outletId is required and must be a number')
    }
    const daysNum = typeof days === 'string' && validator.isNumeric(days) ? parseInt(days) : 7
    // Optional: the client's UTC offset in minutes, so days are bucketed by the
    // user's calendar rather than UTC. `isNumeric` rejects a leading '-', so parse
    // via isInt (offsets west of UTC are negative). Omitted/invalid => 0 = the
    // previous UTC-day behaviour, which keeps older APKs working unchanged.
    const offsetNum = typeof utcOffsetMinutes === 'string' && validator.isInt(utcOffsetMinutes)
        ? parseInt(utcOffsetMinutes)
        : 0
    service.getRevenueTrend(req.user.databaseName, outletIdNum, daysNum, offsetNum)
        .then((trend) => sendResponse(res, trend))
        .catch(next)
}

const getPartiallyPaidSales = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }

    const { outletId, skip, take, lastSyncTimestamp } = req.query;

    // Validate outletId
    if (!outletId || !validator.isNumeric(outletId as string)) {
        throw new RequestValidateError('Valid outletId is required');
    }

    const skipNum = skip && validator.isNumeric(skip as string) ? parseInt(skip as string) : 0;
    const takeNum = Math.min(
        take && validator.isNumeric(take as string) ? parseInt(take as string) : 100,
        MAX_SALES_PAGE_SIZE,
    );

    const paginationRequest = {
        outletId: outletId as string,
        skip: skipNum,
        take: takeNum,
        lastSyncTimestamp: lastSyncTimestamp as string
    };
    service
        .getPartiallyPaidSales(req.user.databaseName, paginationRequest)
        .then(({ data, total, serverTimestamp }) => {
            sendResponse(res, { data: data, total, serverTimestamp });
        })
        .catch(next);
}

interface AddPaymentRequest {
    salesId: number;
    payments: Payment[];
}

// Add this controller function along with other controller functions
const addPaymentToPartiallyPaidSales = (req: NetworkRequest<AddPaymentRequest>, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (Object.keys(req.body).length === 0) {
        throw new RequestValidateError('Request body is empty');
    }
    const requestBody = req.body;
    if (!requestBody) {
        throw new RequestValidateError('Data missing');
    }
    const salesId = requestBody.salesId;
    if (!salesId || salesId === 0) {
        throw new RequestValidateError('Sales ID is required and cannot be 0');
    }
    const payments = requestBody.payments;
    if (!payments || !Array.isArray(payments) || payments.length === 0) {
        throw new RequestValidateError('At least one payment is required');
    }
    service.addPaymentToPartiallyPaidSales(
        req.user.databaseName,
        req.user.tenantId,
        { userId: req.user.userId, username: req.user.username, loyaltyTier: req.user.loyaltyTier },
        salesId,
        payments
    )
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next);
}

const voidSales = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect');
    }
    const salesId: number = parseInt(req.params.id);
    service.voidSales(
        req.user.databaseName,
        req.user.tenantId,
        { userId: req.user.userId, username: req.user.username, loyaltyTier: req.user.loyaltyTier },
        salesId,
        // Acting terminal performing the void (client-supplied, nullable).
        (req.body as any)?.siteId ?? null
    )
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next);
}

const returnSales = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect');
    }
    const salesId: number = parseInt(req.params.id);
    service.returnSales(
        req.user.databaseName,
        req.user.tenantId,
        { userId: req.user.userId, username: req.user.username, loyaltyTier: req.user.loyaltyTier },
        salesId,
        // Acting terminal performing the return (client-supplied, nullable).
        (req.body as any)?.siteId ?? null
    )
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next);
}

const refundSales = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.id)) {
        throw new RequestValidateError('ID format incorrect');
    }
    const salesId: number = parseInt(req.params.id);
    service.refundSales(
        req.user.databaseName,
        req.user.tenantId,
        { userId: req.user.userId, username: req.user.username, loyaltyTier: req.user.loyaltyTier },
        salesId,
        // Acting terminal performing the refund (client-supplied, nullable).
        (req.body as any)?.siteId ?? null
    )
        .then((sales: Sales) => sendResponse(res, sales))
        .catch(next);
}

// Edit the SAFE-METADATA fields of an existing sale — the single sanctioned
// mutation of an otherwise-immutable sale snapshot. Gated behind the
// "Modify Sales History" permission (see route). Whitelists ONLY presentational /
// contact metadata (name, phone, remark, shipping address) that touches NO
// downstream system (stock, payments, loyalty, EOD/reports, receipts). Only
// provided fields are updated; anything else in the body is ignored. Online-first
// on the client (offline-tolerant via the outbox).
const updateSalesContact = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    if (!validator.isNumeric(req.params.salesId)) {
        throw new RequestValidateError('ID format incorrect');
    }
    const salesId: number = parseInt(req.params.salesId);

    const body = (req.body ?? {}) as UpdateSalesDetailsRequest;
    const details: {
        customerName?: string; phoneNumber?: string; remark?: string;
        shipStreet?: string; shipCity?: string; shipState?: string;
        shipPostalCode?: string; shipCountry?: string;
    } = {};

    // Trimmed-string whitelist. Each field is optional and length-capped to the
    // 191-char VARCHAR limit; only fields actually present in the body are patched.
    const stringFields: Array<keyof typeof details> = [
        'customerName', 'phoneNumber', 'remark',
        'shipStreet', 'shipCity', 'shipState', 'shipPostalCode', 'shipCountry',
    ];
    for (const field of stringFields) {
        const value = (body as Record<string, unknown>)[field];
        if (value === undefined) continue;
        if (typeof value !== 'string') {
            throw new RequestValidateError(`${field} must be a string`);
        }
        const trimmed = value.trim();
        if (trimmed.length > 191) {
            throw new RequestValidateError(`${field} too long (max 191 characters)`);
        }
        details[field] = trimmed;
    }

    service.updateSalesContact(req.user.databaseName, salesId, details)
        .then((sales) => sendResponse(res, sales))
        .catch(next);
}

const getDeliveryList = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { outletId, businessDateFrom, businessDateTo, customerId } = req.query;

    if (!outletId || !validator.isNumeric(outletId as string)) {
        throw new RequestValidateError('Valid outletId is required');
    }

    const outletIdNum = parseInt(outletId as string);
    const customerIdNum = customerId && validator.isNumeric(customerId as string) ? parseInt(customerId as string) : undefined;
    const dateFrom = businessDateFrom ? new Date(businessDateFrom as string) : undefined;
    const dateTo = businessDateTo ? new Date(businessDateTo as string) : undefined;

    service.getDeliveryList(
        req.user.databaseName,
        outletIdNum,
        dateFrom,
        dateTo,
        customerIdNum
    )
        .then((deliveryList) => sendResponse(res, deliveryList))
        .catch(next);
}

const confirmDeliveryBatch = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { salesIds, deliveryNotes, deliveredAt } = req.body;

    if (!salesIds || !Array.isArray(salesIds) || salesIds.length === 0) {
        throw new RequestValidateError('salesIds array is required and must not be empty');
    }

    const deliveredAtDate = deliveredAt ? new Date(deliveredAt) : undefined;

    service.confirmDeliveryBatch(
        req.user.databaseName,
        req.user.tenantId,
        { userId: req.user.userId, username: req.user.username },
        salesIds,
        deliveryNotes,
        deliveredAtDate
    )
        .then((result) => {
            sendResponse(res, {
                message: 'Delivery confirmed successfully',
                ...result
            });
        })
        .catch(next);
}

const getDeliveredList = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        throw new RequestValidateError('User not authenticated');
    }
    const { outletId, skip, take, startDate, endDate } = req.query;

    if (!outletId || !validator.isNumeric(outletId as string)) {
        throw new RequestValidateError('Valid outletId is required');
    }
    if (!startDate || !endDate) {
        throw new RequestValidateError('startDate and endDate are required');
    }

    const skipNum = skip && validator.isNumeric(skip as string) ? parseInt(skip as string) : 0;
    const takeNum = Math.min(
        take && validator.isNumeric(take as string) ? parseInt(take as string) : 100,
        MAX_SALES_PAGE_SIZE,
    );

    service.getDeliveredList(
        req.user.databaseName,
        {
            outletId: outletId as string,
            skip: skipNum,
            take: takeNum,
            startDate: startDate as string,
            endDate: endDate as string,
        }
    )
        .then(({ data, total, serverTimestamp }) => {
            sendResponse(res, { data, total, serverTimestamp });
        })
        .catch(next);
}

// sales routes
router.get('/getTotalSalesData', getTotalSalesData)
router.get('/getRevenueTrend', getRevenueTrend)
router.get('/getPartiallyPaidSales', getPartiallyPaidSales)
router.get('/outlet', getAll)
router.get('/dateRange', getAllByDateRange)

// delivery list routes (must be before /:id to avoid route conflict)
router.get('/delivery/list', getDeliveryList);
router.get('/delivery/history', getDeliveredList);
router.post('/delivery/confirm', confirmDeliveryBatch);

// laundry pickup: fetch-by-ref + collect (MUST be before the catch-all /:id,
// otherwise "ref" would be parsed as an :id)
router.get('/ref/:orderRef', getByRef)
router.put('/ref/:orderRef/collect', collect)

// laundry photos (named paths — safe before /:id)
router.post('/photo/upload-url', photoUploadUrl)
router.post('/photo/register', registerPhoto)
router.get('/photo/list/:orderRef', listPhotos)

// digital receipt PDF upload URL (named path — safe before /:id)
router.post('/receipt/upload-url', receiptUploadUrl)

router.get('/:id', getById)
router.post('/calculate', calculateSales)
router.post('/completeNewSales', completeNewSales)
router.post('/addPayment', addPaymentToPartiallyPaidSales);
router.put('/update', update)
router.put('/void/:id', voidSales)
router.put('/return/:id', returnSales)
router.put('/refund/:id', refundSales)
// Safe-metadata edit of a sale (name/phone/remark/shipping address). Gated behind
// "Modify Sales History" — the only permission-gated sales route. Static '/contact'
// suffix (retained for backward-compat with older binaries) keeps it distinct from
// the catch-all '/:id' route. PUT matches the FE's initiatePUT path and the sibling
// void/return/refund verbs above.
router.put('/:salesId/contact', requirePermission(PERMISSION.MODIFY_SALES_HISTORY), updateSalesContact)
router.delete('/:id', remove)

export = router