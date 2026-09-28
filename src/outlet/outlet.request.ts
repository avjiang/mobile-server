export interface CreateOutletRequest {
    outletName: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    outletTel?: string;
    outletEmail?: string;
}

export interface UpdateOutletRequest {
    outletName?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    outletTel?: string;
    outletEmail?: string;
}
