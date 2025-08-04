import { DeliveryOrder, StockBalance } from "../../prisma/client"
import { Decimal as PrismaDecimal } from "../../prisma/client/runtime/library";

interface DeliveryOrderItemInput {
    id?: number; // Add id for updates
    itemId: number;
    orderedQuantity: number;
    receivedQuantity: number;
    unitPrice?: PrismaDecimal;
    remark?: string;
}

export interface DeliveryOrderInput {
    id?: number; // Optional for creation, required for updates
    outletId: number;
    customerId?: number;
    purchaseOrderId?: number;
    supplierId?: number;
    sessionId?: number; // Optional for backwards compatibility
    deliveryDate?: Date;
    deliveryStreet?: string;
    deliveryCity?: string;
    deliveryState?: string;
    deliveryPostalCode?: string;
    deliveryCountry?: string;
    trackingNumber?: string;
    status?: string;
    remark?: string;
    performedBy?: string;
    deliveryOrderItems?: DeliveryOrderItemInput[]; // Add items here
}

export interface CreateDeliveryOrderRequestBody {
    deliveryOrders: DeliveryOrderInput[];
}