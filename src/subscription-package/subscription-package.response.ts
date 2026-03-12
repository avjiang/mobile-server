export interface SubscriptionPackageResponse {
    id: number;
    name: string;
    packageType: string;
    price: number;
    totalQuota: number | null;
    quotaUnit: string | null;
    durationDays: number | null;
    discountPercentage: number | null;
    discountAmount: number | null;
    validityDays: number | null;
    isActive: boolean;
    categories: PackageCategoryResponse[];
}

export interface PackageCategoryResponse {
    categoryId: number;
    categoryName: string;
}

export interface CustomerSubscriptionResponse {
    id: number;
    customerId: number;
    customerName: string;
    subscriptionPackageId: number;
    packageName: string;
    packageType: string;
    status: string;
    startDate: string;
    endDate: string | null;
    remainingQuota: number | null;
    usedQuota: number;
    paidAmount: number;
    packageSnapshot: any;
}

export interface SubscriptionUsageResponse {
    id: number;
    customerSubscriptionId: number;
    salesId: number;
    quantityUsed: number;
    remainingAfter: number;
    performedBy: string | null;
    createdAt: string;
}

export interface CustomerSubscriptionListResponse {
    subscriptions: CustomerSubscriptionResponse[];
    total: number;
}
