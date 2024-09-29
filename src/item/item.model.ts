import { Item } from "@prisma/client";

export interface StockItem extends Item {
    stockQuantity: number
}

export interface ItemSoldObject {
    item: StockItem,
    quantitySold: number
}