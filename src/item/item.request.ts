import { Item } from "@prisma/client"
import { StockItem } from "./item.model"

export interface CreateItemsRequestBody {
    items: StockItem[]
}

export interface CreateItemBody {
    item: Item & { stockQuantity: number }
}