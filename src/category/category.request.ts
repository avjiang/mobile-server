import { Category } from "@prisma/tenant-prisma"

export interface CreateCategoryRequestBody {
    categories: Category[]
}