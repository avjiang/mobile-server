import { Category } from "@prisma/client"

export interface CreateCategoryRequestBody {
    categories: Category[]
}