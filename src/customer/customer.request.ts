import { Customer } from "@prisma/tenant-prisma"

export interface CreateCustomersRequestBody {
    customers: Customer[]
}