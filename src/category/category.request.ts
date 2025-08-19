import { Category } from "../../prisma/client/generated/client"

export interface CreateCategoryRequestBody {
    categories: Category[]
}