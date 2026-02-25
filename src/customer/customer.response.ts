import { Expose } from "class-transformer";

export class CustomerDto {
    @Expose() id: number = 0;
    @Expose() salutation: string = "";
    @Expose() lastName: string = "";
    @Expose() firstName: string = "";
    @Expose() mobile: string = "";
    @Expose() email: string = "";
    @Expose() gender: string = "";
    @Expose() billStreet: string = "";
    @Expose() billCity: string = "";
    @Expose() billState: string = "";
    @Expose() billPostalCode: string = "";
    @Expose() billCountry: string = "";
    @Expose() billRemark: string = "";
    @Expose() shipStreet: string = "";
    @Expose() shipCity: string = "";
    @Expose() shipState: string = "";
    @Expose() shipPostalCode: string = "";
    @Expose() shipCountry: string = "";
    @Expose() shipRemark: string = "";
    @Expose() deleted: boolean = false;
}
