import { Category } from "@tenant-prisma"

export interface CreateCategoryRequestBody {
    categories: Category[]
}