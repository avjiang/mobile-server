import { Supplier } from "@tenant-prisma"

export interface CreateSuppliersRequestBody {
    suppliers: Supplier[]
}