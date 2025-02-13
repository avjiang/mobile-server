import { NextFunction, Request, Response } from "express";
import NetworkResponse from "../api-helpers/network-response";
import { BaseError, ResponseError, AuthenticationError } from "../api-helpers/error";
import { Prisma } from "@prisma/client";

export default (error: Error, req: Request, res: Response, next: NextFunction) => {
    var statusCode: number = 500;
    var responseError: ResponseError = new ResponseError(error.constructor.name, error.message);

    if (error instanceof BaseError) {
        statusCode = error.statusCode;
    }
    else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        responseError.errorMessage = `[Code: ${error.code}] - ${error.message}`;
    }

    // Check if error is an authorization error (AuthenticationError) and update the message
    if (error instanceof AuthenticationError) {
        responseError.errorMessage = `Authorization error: ${error.message}`;
    }

    const response = new NetworkResponse(false, responseError);

    res.status(statusCode).json(response);
}