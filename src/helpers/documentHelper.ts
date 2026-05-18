import { RequestValidateError } from "../api-helpers/error";

export function validateDocumentNumber(documentNumber: string | undefined | null) {
    if (!documentNumber) {
        throw new RequestValidateError('Document number is required');
    }
    
    // Expected format: {PREFIX}-OUT{outletId}-{yyyyMMdd}-{sequence}
    // Examples: INV-OUT1-20231024-0001, SA-OUT2-20231024-1234
    const regex = /^[A-Z]+-OUT\d+-\d{8}-\d+$/;
    
    if (!regex.test(documentNumber)) {
        throw new RequestValidateError(`Invalid document number format: ${documentNumber}. Expected format: {PREFIX}-OUT{outletId}-{yyyyMMdd}-{sequence}`);
    }
}
