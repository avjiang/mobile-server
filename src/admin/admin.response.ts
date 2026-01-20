import { Expose, Transform } from "class-transformer";
import { PrismaClient, Tenant, TenantUser, SubscriptionPlan, TenantSubscription } from "../../prisma/global-client/generated/global";

type TenantUserWithoutPassword = Omit<TenantUser, 'password'>;

// Response type with renamed keys
type TenantUserResponse = Omit<TenantUser, 'password' | 'tenantId'> & {
    globalTenantId: number;
};

export class TenantDto {
    @Expose()
    id = 0;

    @Expose()
    tenantName = String();

    @Expose()
    databaseName = String();

    @Expose()
    createdAt: Date = new Date();
}

export class GetAllTenantDto { }

export class TenantCreationDto {
    @Expose()
    @Transform(({ obj }) => ({ planName: obj.subscriptionPlan.planName }))
    subscription: { planName: string };

    tenant: TenantDto;
    tenantUser: TenantUserResponse;

    warehouse?: {
        id: number;
        warehouseName: string;
        warehouseCode: string;
        globalWarehouseId: number;
    };

    constructor(
        tenant: TenantDto,
        tenantUser: TenantUserWithoutPassword,
        subscription: TenantSubscription & { subscriptionPlan: SubscriptionPlan },
        warehouse?: {
            id: number;
            warehouseName: string;
            warehouseCode: string;
            tenantWarehouseId: number;
        }
    ) {
        this.subscription = { planName: subscription.subscriptionPlan.planName };
        this.tenant = tenant;

        // Transform tenantId to globalTenantId
        const { tenantId, ...userWithoutTenantId } = tenantUser;
        this.tenantUser = {
            ...userWithoutTenantId,
            globalTenantId: tenantId,
        };

        // Transform tenantWarehouseId to globalWarehouseId
        if (warehouse) {
            this.warehouse = {
                id: warehouse.id,
                warehouseName: warehouse.warehouseName,
                warehouseCode: warehouse.warehouseCode,
                globalWarehouseId: warehouse.tenantWarehouseId,
            };
        }
    }
}

export interface TenantCostResponse {
    tenantId: number;
    tenantName: string;
    outletCount: number;
    outlets: Array<{
        outletId: number;
        outletName: string;
        subscription: {
            planName: string;
            basePlanCost: number;
            addOns: Array<{
                name: string;
                quantity: number;
                pricePerUnit: number;
                totalCost: number;
            }>;
            discounts: Array<{
                name: string;
                type: string;
                value: number;
                amount: number;
            }>;
            totalCost: number;
            totalCostBeforeDiscount: number;
            totalDiscount: number;
            status: string;
            subscriptionValidUntil: string;
        } | null;
    }>;
    totalMonthlyCost: number;
    totalCostBeforeDiscount: number;
    totalDiscount: number;
}

export interface TotalCostResponse {
    totalRevenue: number;
    totalRevenueBeforeDiscount: number;
    totalDiscount: number;
    tenants: Array<{
        tenantId: number;
        tenantName: string;
        createdAt: Date;
        planName: string;
        totalMonthlyCost: number;
        totalCostBeforeDiscount: number;
        totalDiscount: number;
    }>;
}

// ============================================
// Payment Management Response Types
// ============================================

// Cost snapshot stored with each payment for historical audit
export interface CostSnapshot {
    planName: string;
    planId: number;
    basePlanCost: number;
    addOns: Array<{
        addOnId: number;
        name: string;
        quantity: number;
        pricePerUnit: number;
        totalCost: number;
    }>;
    discounts: Array<{
        discountId: number;
        name: string;
        type: string;
        value: number;
        amountOff: number;
    }>;
    totalBeforeDiscount: number;
    totalDiscount: number;
    totalAfterDiscount: number;
}

// Single payment record response
export interface TenantPaymentResponse {
    id: number;
    invoiceNumber: string;
    tenantId: number;
    outletId: number;
    outletName: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    referenceNumber: string | null;
    paymentDate: string;
    periodFrom: string;
    periodTo: string;
    extensionMonths: number;
    costSnapshot: CostSnapshot;
    recordedAt: string;
}

// Response for recording a payment
export interface RecordPaymentResponse {
    success: boolean;
    message: string;
    payment: TenantPaymentResponse;
    subscription: {
        previousValidUntil: string;
        newValidUntil: string;
        status: string;
    };
}

// Paginated payment list response
export interface PaymentListResponse {
    payments: TenantPaymentResponse[];
    total: number;
    limit: number;
    offset: number;
}

// All payments response (includes tenant name)
export interface AllPaymentsResponse {
    payments: Array<TenantPaymentResponse & { tenantName: string }>;
    total: number;
    limit: number;
    offset: number;
}

// Consolidated billing summary for a tenant
export interface TenantBillingSummaryResponse {
    tenantId: number;
    tenantName: string;
    totalMonthlyCost: number;
    outlets: Array<{
        outletId: number;
        outletName: string;
        subscriptionStatus: string;
        subscriptionValidUntil: string;
        graceEndDate: string;
        daysUntilExpiry: number;
        planName: string;
        basePlanCost: number;
        addOns: Array<{ name: string; quantity: number; totalCost: number }>;
        discounts: Array<{ name: string; amount: number }>;
        outletTotalCost: number;
    }>;
}

// Upcoming payments summary counts
export interface UpcomingPaymentsSummaryResponse {
    days: number;
    summary: {
        activeExpiring: number;
        graceExpiring: number;
        expiredCount: number;
        totalTenants: number;
        totalOutlets: number;
    };
}

// Upcoming payments paginated list
export interface UpcomingPaymentsResponse {
    upcomingPayments: Array<{
        tenantId: number;
        tenantName: string;
        outletCount: number;
        totalMonthlyCost: number;
        mostUrgentExpiry: string;
        mostUrgentStatus: string;
    }>;
    totalCount: number;
    limit: number;
    offset: number;
}

// ============================================
// User Management Response Types
// ============================================

// Get all users for a tenant
export interface TenantUsersResponse {
    tenantId: number;
    tenantName: string;
    users: Array<{
        id: number;
        username: string;
        role: string;
        isDeleted: boolean;
    }>;
    total: number;
    activeCount: number;
}
