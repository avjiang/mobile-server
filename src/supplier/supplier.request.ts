import { Supplier } from "../../prisma/client/generated/client"

export interface CreateSuppliersRequestBody {
    suppliers: Supplier[]
}