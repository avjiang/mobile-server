import { MenuCategory, MenuItem, MenuItemModifier, MenuItemModifierGroup, MenuProfile } from "../../prisma/client/generated/client";

export interface CreateMenuProfileRequestBody {
    menuProfile: MenuProfileRequestBody
}

export interface MenuProfileRequestBody extends MenuProfile {
    menuCategories: MenuCategoryRequest[]
}

export interface MenuCategoryRequest extends MenuCategory {
    menuItems: MenuItemRequest[]
}

export interface MenuItemRequest extends MenuItem {
    menuModifierGroups: MenuModifierGroupRequest[]
}

export interface MenuModifierGroupRequest extends MenuItemModifierGroup {
    menuItemModifiers: MenuItemModifier[]
}