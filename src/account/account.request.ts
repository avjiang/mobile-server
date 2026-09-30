import { Expose, Transform, Type } from "class-transformer";

export interface AccountRequest {
    /**
     * Tenant-local outlet id (matches `<tenant_db>.outlet.id`). The outlet
     * authorization middleware already validates this against the JWT's
     * `allowedOutletIds`, which are tenant-local. The service resolves it
     * internally to the corresponding `global.tenant_outlet.id`.
     */
    outletId?: number;
    tenantId?: number;
    /** Tenant database name from JWT (`req.user.databaseName`). */
    databaseName?: string;
}