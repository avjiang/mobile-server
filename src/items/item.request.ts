import { Item } from "@prisma/client"

export interface CreateItemsRequestBody {
    items: Item[]
}