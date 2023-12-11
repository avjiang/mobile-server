import { Response } from "express";
import NetworkResponse from "./network-response";

export let sendResponse = (res: Response, data: any)  => {
    const response = new NetworkResponse(true, data)
    return res.json(response)
}