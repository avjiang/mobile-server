import { Expose, Transform, Type } from "class-transformer";

// Laundry vertical recipe line (bill-of-materials). Sent on create/update of a
// "service" item, and echoed back on sync so the client can prefill the sale dialog.
export class ItemConsumableDto {
    @Expose()
    consumableItemId: number = 0;

    @Expose()
    ratePerKg: number = 0;

    @Expose()
    unit: string = "Milliliter";

    // 'perKg' (rate × load weight) | 'perLoad' (flat amount per wash).
    @Expose()
    consumptionBasis: string = "perKg";
}

export class ItemSoldRankingResponseBody {
    topSoldItems: ItemSoldObject[] = [];
    // leastSoldItem: ItemSoldObject | null = null;
}

export class ItemSoldObject {
    item: ItemDto = new ItemDto();
    quantitySold: number = 0;
    totalRevenue: number = 0;
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
    itemBrand: string = "";

    @Expose()
    alternateLookup: string | undefined = undefined;

    // @Expose()
    // itemDescription: string | undefined = undefined;

    @Expose()
    categoryId: number = 0;

    @Expose()
    cost: number = 0;

    @Expose()
    price: number = 0;

    @Expose()
    reorderThreshold: number = 0;

    @Expose()
    hasTax: boolean = false;

    // @Expose()
    // isOpenPrice: boolean = false;

    @Expose()
    unitOfMeasure: string | undefined = undefined;

    // @Expose()
    // height: number | undefined = undefined;

    // @Expose()
    // width: number | undefined = undefined;

    // @Expose()
    // length: number | undefined = undefined;

    // @Expose()
    // weight: number | undefined = undefined;

    // @Expose()
    // alternateLookUp: string | undefined = undefined;

    // @Expose()
    // image: string | undefined = undefined;

    @Expose()
    supplierId: number = 0;

    @Expose()
    deleted: boolean = false;

    @Expose()
    trackStock: boolean = true;

    // Terminal attribution — the terminal that created this item (RegisteredDevice
    // siteId). Must be @Expose'd or class-transformer (excludeExtraneousValues)
    // drops it before createMany. Stamped on the item's stock movements.
    @Expose()
    siteId: number | undefined = undefined;

    // Laundry: default machine-load weight (kg) for a service item; prefills the sale dialog.
    @Expose()
    defaultLoadWeightKg: number | undefined = undefined;

    // How PRICE becomes a line total: null/'per_piece' (legacy), 'flat_per_load'
    // (price charged as-is per load), 'per_kg' (price × actual weight, reserved).
    @Expose()
    pricingMode: string | undefined = undefined;

    // Laundry: recipe lines for a service item (the supplies it consumes).
    @Expose()
    @Type(() => ItemConsumableDto)
    consumables: ItemConsumableDto[] | undefined = undefined;

    @Expose({ name: 'stockQuantity' })
    @Transform(({ value, obj }) => value !== undefined ? value : (obj.stock?.availableQuantity ?? 0), { toClassOnly: true })
    stockQuantity: number = 0;

    @Expose()
    variants?: any[];
}