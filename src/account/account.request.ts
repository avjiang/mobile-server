import { Expose, Transform, Type } from "class-transformer";

export interface AccountRequest {
    outletId?: number;
    tenantId?: number;
}