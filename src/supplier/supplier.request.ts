import { Supplier } from "@prisma/tenant-prisma"

export interface CreateSuppliersRequestBody {
    suppliers: Supplier[]
}