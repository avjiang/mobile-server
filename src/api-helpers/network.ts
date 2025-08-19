import { Response } from "express";
import NetworkResponse from "./network-response";
import { Decimal } from "@tenant-prisma/runtime/library";
import { ResponseError } from "./error";

let convertDecimalsToNumbers = (value: any): any => {
    if (value instanceof Decimal) {
        return value.toNumber();
    } else if (value instanceof Date) {
        return value;
    } else if (Array.isArray(value)) {
        return value.map(convertDecimalsToNumbers);
    } else if (typeof value === 'object' && value !== null) {
        const newValue: any = {}
        for (const key in value) {
            newValue[key] = convertDecimalsToNumbers(value[key])
        }
        return newValue;
    } else {
        return value;
    }
}

let isString = (value: any) => {
    return typeof value === 'string' || value instanceof String
}

export let sendResponse = (res: Response, data: any) => {
    if (!isString(data)) {
        //need to map decimal datatype to number datatype else decimal datatype value will return as string value
        for (const key in data) {
            data[key] = convertDecimalsToNumbers(data[key]);
        }
    }
    const response = new NetworkResponse(true, data)
    return res.json(response)
}

export let sendErrorResponse = (res: Response, responseError: ResponseError, statusCode: number) => {
    const response = new NetworkResponse(false, responseError);
    return res.status(statusCode).json(response);
};