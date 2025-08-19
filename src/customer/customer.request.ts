import { Customer } from "../../prisma/client/generated/client"

export interface CreateCustomersRequestBody {
    customers: Customer[]
}