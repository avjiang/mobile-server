import { NextFunction, Request, Response } from "express";
import NetworkResponse from "../api-helpers/network-response";
import { BaseError, ResponseError, AuthenticationError, VersionMismatchError } from "../api-helpers/error";
import { Prisma } from "../../prisma/client/generated/client";
import { sendErrorResponse } from "../api-helpers/network";
import jwt from "jsonwebtoken";

export default (error: Error, req: Request, res: Response, next: NextFunction) => {
    let statusCode: number = 500;
    let responseError: ResponseError;

    console.log("Prisma error:", error);
    if (error instanceof VersionMismatchError) {
        // Handle VersionMismatchError specifically
        responseError = new ResponseError(error.name, error.message, error.mismatches);
        statusCode = error.statusCode;
    } else if (error instanceof BaseError) {
        // Handle other BaseError instances. `errorCode`/`params` ride along when
        // the thrower set them, so the client can render a translated message
        // (see ErrorCode in api-helpers/error.ts); `errorMessage` stays the
        // English fallback for clients that don't know the code.
        responseError = new ResponseError(error.name, error.message, undefined, error.errorCode, error.params);
        statusCode = error.statusCode;
    } else if (error instanceof Prisma.PrismaClientValidationError) {
        const fieldMatch = error.message.match(/Argument `(\w+)`/) ||
            error.message.match(/Field name = (\w+)/) ||
            error.message.match(/Unknown field `([^`]+)`/);

        const typeMatch = error.message.match(/Expected (\w+), provided (\w+)/);
        const valueMatch = error.message.match(/got '([^']+)'/) ||
            error.message.match(/provided (\w+)/) ||
            error.message.match(/provided `([^`]+)`/);

        const schemaMatch = error.message.match(/to satisfy the constraint of the `([^`]+)` field/);
        const constraintMatch = error.message.match(/`([^`]+)` constraint/);

        const field = fieldMatch?.[1] || schemaMatch?.[1] || 'a field in your input';
        const expectedType = typeMatch?.[1] || constraintMatch?.[1] || 'expected format';
        const providedValue = valueMatch?.[1] || 'invalid value';

        let message = '';

        if (/Argument `\w+` is required/.test(error.message)) {
            message = `Missing required field: ${field}.`;
        } else if (/Unknown field/.test(error.message)) {
            message = `Unknown field '${field}'. This field does not exist in the schema.`;
        } else if (/Invalid enum value/.test(error.message)) {
            message = `Invalid value '${providedValue}' for field '${field}'. Must be one of the allowed enum values.`;
        } else if (typeMatch) {
            message = `Invalid data type for '${field}'. Expected ${expectedType.toLowerCase()}, received '${providedValue}'.`;
        } else if (/constraint/.test(error.message)) {
            message = `Value '${providedValue}' for field '${field}' violates the ${expectedType} constraint.`;
        } else {
            message = `Validation error on field '${field}': ${error.message}`;
        }
        statusCode = 400;
        responseError = new ResponseError(error.name, message);
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Prefer the structured error `code` + `meta` over regex-scraping the
        // message. The known-request errors (P2002 unique, P2003 FK, P2011
        // null, P2025 not-found) carry the offending field(s) in `meta.target`,
        // so we can build a precise, human message instead of the useless
        // "Value 'invalid value' for field 'a field in your input' violates the
        // expected format constraint." fallback (which is what a P2002 produced
        // before — the regexes below never match a P2002 message).
        const target = (error.meta as any)?.target;
        const targetField = Array.isArray(target) ? target.join(', ') : (target ?? '');

        let message = '';
        let handled = true;
        switch (error.code) {
            case 'P2002':
                // Unique constraint violation. On the sales path this is almost
                // always a duplicate ORDER_REF from a re-submitted/replayed order.
                message = targetField
                    ? `A record with this ${targetField} already exists. It may have already been submitted — please refresh before retrying.`
                    : `This record already exists. It may have already been submitted — please refresh before retrying.`;
                statusCode = 409;
                break;
            case 'P2003':
                message = targetField
                    ? `Related record not found for ${targetField}. Please make sure the referenced item still exists.`
                    : `A related record referenced by this request does not exist.`;
                statusCode = 400;
                break;
            case 'P2011':
                message = targetField
                    ? `Missing required value for ${targetField}.`
                    : `A required value is missing.`;
                statusCode = 400;
                break;
            case 'P2025':
                message = `The requested record was not found. It may have been deleted.`;
                statusCode = 404;
                break;
            default:
                handled = false;
        }

        if (!handled) {
            const fieldMatch = error.message.match(/Argument `(\w+)`/) ||
                error.message.match(/Field name = (\w+)/) ||
                error.message.match(/Unknown field `([^`]+)`/);

            const typeMatch = error.message.match(/Expected (\w+), provided (\w+)/);
            const valueMatch = error.message.match(/got '([^']+)'/) ||
                error.message.match(/provided (\w+)/) ||
                error.message.match(/provided `([^`]+)`/);

            const schemaMatch = error.message.match(/to satisfy the constraint of the `([^`]+)` field/);
            const constraintMatch = error.message.match(/`([^`]+)` constraint/);

            const field = fieldMatch?.[1] || schemaMatch?.[1] || 'a field in your input';
            const expectedType = typeMatch?.[1] || constraintMatch?.[1] || 'expected format';
            const providedValue = valueMatch?.[1] || 'invalid value';

            if (/Argument `\w+` is required/.test(error.message)) {
                message = `Missing required field: ${field}.`;
            } else if (/Unknown field/.test(error.message)) {
                message = `Unknown field '${field}'. This field does not exist in the schema.`;
            } else if (/Invalid enum value/.test(error.message)) {
                message = `Invalid value '${providedValue}' for field '${field}'. Must be one of the allowed enum values.`;
            } else if (typeMatch) {
                message = `Invalid data type for '${field}'. Expected ${expectedType.toLowerCase()}, received '${providedValue}'.`;
            } else if (/constraint/.test(error.message)) {
                message = `Value '${providedValue}' for field '${field}' violates the ${expectedType} constraint.`;
            } else {
                message = `Validation error on field '${field}': ${error.message}`;
            }
            statusCode = 400;
        }
        responseError = new ResponseError(error.name, message);
    } else if (error instanceof AuthenticationError) {
        // Handle AuthenticationError
        responseError = new ResponseError(error.name, `Authorization error: ${error.message}`);
        statusCode = 401; // Assuming AuthenticationError uses 401
    } else if (error instanceof jwt.JsonWebTokenError) {
        // Raw jsonwebtoken errors (TokenExpiredError / NotBeforeError both extend
        // JsonWebTokenError) thrown by jwt.verify in authService.validateToken.
        // An expired or invalid token is a normal, expected client condition — it
        // must surface as 401 Unauthorized, not fall through to the 500 fallback
        // below (which was firing the App Service Http5xx alert on every expiry).
        const message = error instanceof jwt.TokenExpiredError ? 'Token has expired' : 'Invalid authentication token';
        responseError = new ResponseError(error.name, message);
        statusCode = 401;
    } else {
        // Fallback for unknown errors
        responseError = new ResponseError(error.name, error.message);
    }
    return sendErrorResponse(res, responseError, statusCode);
};
