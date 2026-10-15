// F&B modifier library (docs/modules/FNB.md). A group ("Level pedas") holds its
// options ("Tidak pedas", "Sedang", "Pedas"); groups are assigned to menu items.

export interface ModifierInput {
    // Present = edit that option; absent = a new option.
    id?: number
    name: string
    price?: number
    // Optional stocked good this option is (extra egg → "Telur"); stock deduction lands in P3.
    itemId?: number | null
    isAvailable?: boolean
    isDefault?: boolean
    sequence?: number
}

export interface SaveModifierGroupRequest {
    name: string
    minSelect?: number
    maxSelect?: number
    freeLimit?: number | null
    sequence?: number
    // The full option list: an existing option missing from it is soft-deleted.
    modifiers: ModifierInput[]
    // Optional: the menu items this group is offered on. Absent = links untouched.
    itemIds?: number[]
}

export interface SetItemModifierGroupsRequest {
    // Ordered: the picker shows the groups in this order.
    groupIds: number[]
}

export interface SetAvailabilityRequest {
    isAvailable: boolean
}
