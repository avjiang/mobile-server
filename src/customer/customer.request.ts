import { Customer } from "prisma/client"

export interface CreateCustomersRequestBody {
    customers: Customer[]
}