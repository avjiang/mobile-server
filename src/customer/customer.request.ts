import { Customer } from "@tenant-prisma"

export interface CreateCustomersRequestBody {
    customers: Customer[]
}