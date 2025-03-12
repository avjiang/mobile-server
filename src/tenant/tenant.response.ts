import { Expose, Transform } from "class-transformer";

export class TenantDto {
    @Expose()
    tenantName = String();

    @Expose()
    databaseName = String();

    @Expose()
    @Transform(({ obj }) => obj.plan?.planName || '')
    planName: string = '';

    @Expose()
    createdAt: Date = new Date();
}