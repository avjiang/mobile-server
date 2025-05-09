import { NextFunction, Request, Response } from "express";
import NetworkResponse from "../api-helpers/network-response";
import { BaseError, ResponseError, AuthenticationError, VersionMismatchError } from "../api-helpers/error";
import { Prisma } from "@prisma/client";
import { sendErrorResponse } from "../api-helpers/network";

export default (error: Error, req: Request, res: Response, next: NextFunction) => {
    let statusCode: number = 500;
    let responseError: ResponseError;

    console.log("Prisma error:", error);
    if (error instanceof VersionMismatchError) {
        // Handle VersionMismatchError specifically
        responseError = new ResponseError(error.name, error.message, error.mismatches);
        statusCode = error.statusCode;
    } else if (error instanceof BaseError) {
        // Handle other BaseError instances
        responseError = new ResponseError(error.name, error.message);
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
    } else if (error instanceof AuthenticationError) {
        // Handle AuthenticationError
        responseError = new ResponseError(error.name, `Authorization error: ${error.message}`);
        statusCode = 401; // Assuming AuthenticationError uses 401
    } else {
        // Fallback for unknown errors
        responseError = new ResponseError(error.name, error.message);
    }
    return sendErrorResponse(res, responseError, statusCode);
};
