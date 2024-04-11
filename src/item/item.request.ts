import { Item } from "@prisma/client"

export interface CreateItemsRequestBody {
    items: StockItem[]
}

export interface CreateItemBody {
    item: Item & { stockQuantity: number }
}

export interface StockItem extends Item {
    stockQuantity: number
}