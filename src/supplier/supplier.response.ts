import { Expose } from "class-transformer";

export class SupplierDto {
    @Expose() id: number = 0;
    @Expose() companyName: string = "";
    @Expose() companyStreet: string = "";
    @Expose() companyCity: string = "";
    @Expose() companyState: string = "";
    @Expose() companyPostalCode: string = "";
    @Expose() companyCountry: string = "";
    @Expose() companyRegisterNumber: string = "";
    @Expose() personInChargeLastName: string = "";
    @Expose() personInChargeFirstName: string = "";
    @Expose() mobile: string = "";
    @Expose() email: string = "";
    @Expose() remark: string = "";
    @Expose() hasTax: boolean = false;
    @Expose() deleted: boolean = false;
    @Expose() itemCount: number = 0;
}