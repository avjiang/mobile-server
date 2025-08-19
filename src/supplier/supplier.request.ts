import { Supplier } from "prisma/client"

export interface CreateSuppliersRequestBody {
    suppliers: Supplier[]
}