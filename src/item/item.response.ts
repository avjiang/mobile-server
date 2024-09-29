import { ItemSoldObject } from "./item.model";

export interface ItemSoldRankingResponseBody {
    topSoldItems: ItemSoldObject[]
    leastSoldItem: ItemSoldObject
}