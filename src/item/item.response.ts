import { Decimal } from "@prisma/client/runtime/library";
import { Expose, Transform } from "class-transformer";

export class ItemSoldRankingResponseBody {
    topSoldItems: ItemSoldObject[] = [];
    leastSoldItem: ItemSoldObject | null = null;
}

export class ItemSoldObject {
    item: ItemDto = new ItemDto();
    quantitySold: number = 0;
}

export class ItemDto {
    @Expose()
    id: number = 0;

    @Expose()
    itemCode: string = "";

    @Expose()
    itemName: string = "";

    @Expose()
    itemType: string | undefined = undefined;

    @Expose()
    itemModel: string | undefined = undefined;

    @Expose()
    itemBrand: string | undefined = undefined;

    @Expose()
    itemDescription: string | undefined = undefined;

    @Expose()
    category: string | undefined = undefined;

    @Expose()
    cost: number = 0;

    @Expose()
    price: number = 0;

    @Expose()
    isOpenPrice: boolean = false;

    @Expose()
    unitOfMeasure: string | undefined = undefined;

    @Expose()
    height: number | undefined = undefined;

    @Expose()
    width: number | undefined = undefined;

    @Expose()
    length: number | undefined = undefined;

    @Expose()
    weight: number | undefined = undefined;

    @Expose()
    alternateLookUp: string | undefined = undefined;

    @Expose()
    image: string | undefined = undefined;

    @Expose()
    supplierId: number = 0;

    @Expose()
    deleted: boolean = false;

    @Expose({ name: 'stockQuantity' })
    @Transform(({ value, obj }) => value !== undefined ? value : (obj.stock?.availableQuantity ?? 0), { toClassOnly: true })
    stockQuantity: number = 0;
}