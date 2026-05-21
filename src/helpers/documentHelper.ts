import { RequestValidateError } from "../api-helpers/error";

export function validateDocumentNumber(
    documentNumber: string | undefined | null,
    outletId?: number,
) {
    if (!documentNumber) {
        throw new RequestValidateError('Document number is required');
    }

    // Expected format: {PREFIX}-OUT{outletId}-{yyyyMMdd}-{sequence}
    // Examples: INV-OUT1-20231024-0001, SA-OUT2-20231024-1234
    const regex = /^[A-Z]+-OUT\d+-\d{8}-\d+$/;

    if (!regex.test(documentNumber)) {
        throw new RequestValidateError(`Invalid document number format: ${documentNumber}. Expected format: {PREFIX}-OUT{outletId}-{yyyyMMdd}-{sequence}`);
    }

    // Defence-in-depth: assert the embedded outlet matches the request outletId
    if (outletId !== undefined) {
        const match = documentNumber.match(/^[A-Z]+-OUT(\d+)-/);
        const embeddedOutletId = match ? parseInt(match[1], 10) : null;
        if (embeddedOutletId !== outletId) {
            throw new RequestValidateError(
                `Document number outlet (OUT${embeddedOutletId}) does not match request outletId (${outletId})`
            );
        }
    }
}
