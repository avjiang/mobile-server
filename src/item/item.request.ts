import { ItemDto } from "./item.response"
import { Expose, Transform, Type } from "class-transformer";

export class CreateItemsRequestBody {
    @Type(() => ItemDto)
    @Expose()
    items: ItemDto[] = []
}