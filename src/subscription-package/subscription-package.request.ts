export interface CreatePackageRequest {
    name: string;
    packageType: 'USAGE' | 'TIME';
    price: number;
    totalQuota?: number;
    quotaUnit?: string;
    durationDays?: number;
    discountPercentage?: number;
    discountAmount?: number;
    validityDays?: number;
    categoryIds?: number[];
}

export interface UpdatePackageRequest {
    name?: string;
    packageType?: 'USAGE' | 'TIME';
    price?: number;
    totalQuota?: number;
    quotaUnit?: string;
    durationDays?: number;
    discountPercentage?: number;
    discountAmount?: number;
    validityDays?: number;
    isActive?: boolean;
    categoryIds?: number[];
}

export interface SubscribeCustomerRequest {
    customerId: number;
    subscriptionPackageId: number;
    paidAmount: number;
}

export interface RecordUsageRequest {
    customerSubscriptionId: number;
    salesId: number;
    quantityUsed?: number;
}

export interface CancelSubscriptionRequest {
    reason?: string;
}
