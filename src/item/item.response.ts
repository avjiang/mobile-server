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

// One item <-> supplier link. `cost` here is a REFERENCE price used to prefill a PO
// line for this supplier — real COGS always comes from StockReceipt.cost at DO receipt.
export class ItemSupplierDto {
    @Expose()
    supplierId: number = 0;

    // Exactly one entry per item carries true; it mirrors Item.supplierId.
    @Expose()
    isPreferred: boolean = false;

    @Expose()
    supplierItemCode: string | null = null;

    @Expose()
    cost: number | null = null;

    @Expose()
    leadTimeDays: number | null = null;
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

    // The PREFERRED supplier. Kept as a scalar forever — every display-only read site
    // (POS tile, barcode print, dashboard stock lists) reads it instead of joining the
    // junction, and old app binaries depend on it being present. Never remove.
    @Expose()
    supplierId: number = 0;

    // Every supplier this item can be purchased from. Undefined = "not sent", which
    // leaves the junction untouched server-side (old binaries, replayed outbox entries).
    // An absent array must never be read as "remove all suppliers".
    @Expose()
    @Type(() => ItemSupplierDto)
    suppliers: ItemSupplierDto[] | undefined = undefined;

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

    // Retail / F&B online-catalogue product specifications: a single free-text
    // block (the whole spec sheet) stored in the JSON column as a JSON string.
    // Must be @Expose'd or class-transformer (excludeExtraneousValues on the
    // create path) drops it before createMany. The update path passes req.body
    // raw, so it flows there regardless.
    @Expose()
    specifications: string | undefined = undefined;

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