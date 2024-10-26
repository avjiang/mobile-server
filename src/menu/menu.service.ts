import { MenuCategory, MenuItem, MenuItemModifierGroup, MenuProfile, PrismaClient } from "@prisma/client"
import { NotFoundError, RequestValidateError } from "../api-helpers/error"
import { CreateMenuProfileRequestBody, MenuProfileRequestBody } from "./menu.request"

const prisma = new PrismaClient()

let linkMenuProfileToOutlet = async (menuProfileID: number, outletID: number) => {
    try {
        await prisma.menuProfileOutlet.create({
            data: {
                menuProfileID: menuProfileID,
                outletId: outletID
            }
        })
        return true
    }
    catch (error) {
        throw error
    }
}

let getAllMenuProfiles = async () => {
    try {
        const menuProfiles = await prisma.menuProfile.findMany({
            include: {
                menuCategories: {
                    include: { 
                        menuItems: {
                            include: {
                                menuItemModifierGroups: {
                                    include: {
                                        menuItemModifiers: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })
        return menuProfiles
    }
    catch (error) {
        throw error
    }
}

let getMenuProfilesCountByOutletID = async (outletID: number) => {
    try {
        const menuProfileCount = await prisma.menuProfileOutlet.count({
            where: {
                outletId: outletID
            }
        })
        return menuProfileCount
    }
    catch (error) {
        throw error
    }
}

let getMenuProfilesByOutletID = async (outletID: number) => {
    try {
        const menuProfileOutletArray = await prisma.menuProfileOutlet.findMany({
            where: {
                outletId: outletID
            },
            select: {
                menuProfileID: true
            }
        })

        if (!menuProfileOutletArray) {
            throw new NotFoundError("Menu Profile")
        }
        const menuProfileIDArray = menuProfileOutletArray.map(menuProfileOutlet => menuProfileOutlet.menuProfileID)
        const menuProfiles = await prisma.menuProfile.findMany({
            where: {
                id: {
                    in: menuProfileIDArray
                }
            },
            include: {
                menuCategories: {
                    include: {
                        menuItems: {
                            include: {
                                menuItemModifierGroups: {
                                    include: {
                                        menuItemModifiers: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        if (!menuProfiles) {
            throw new NotFoundError("Menu Profile")
        }

        return menuProfiles
    }
    catch (error) {
        throw error
    }
}

let createMenuProfile = async (menuProfileRequest: MenuProfileRequestBody) => {
    try {
        await prisma.$transaction(async (tx) => {
            const { menuCategories, ...menuProfileWithoutCategory } = menuProfileRequest
            const menuProfile = menuProfileWithoutCategory as MenuProfile

            const newMenuProfile = await tx.menuProfile.create({
                data: menuProfile
            })

            for (const menuCategoryRequest of menuCategories) {
                const { menuItems, ...menuCategoryWithoutMenuItem } = menuCategoryRequest
                var menuCategory = menuCategoryWithoutMenuItem as MenuCategory
                menuCategory.menuProfileID = newMenuProfile.id
                const newMenuCategory = await tx.menuCategory.create({
                    data: menuCategory
                })

                for (const menuItemRequest of menuItems) {
                    const { menuModifierGroups, ...menuItemWithoutMenuItemModifierGroup } = menuItemRequest
                    var menuItem = menuItemWithoutMenuItemModifierGroup as MenuItem
                    menuItem.menuCategoryID = newMenuCategory.id
                    const newMenuItem = await tx.menuItem.create({
                        data: menuItem
                    })

                    for (const menuModifierGroupRequest of menuModifierGroups) {
                        const { menuItemModifiers, ...menuModifierGroupWithoutMenuItemModifier } = menuModifierGroupRequest
                        var menuModifierGroup = menuModifierGroupWithoutMenuItemModifier as MenuItemModifierGroup
                        menuModifierGroup.menuItemID = newMenuItem.id
                        const newMenuModifierGroup = await tx.menuItemModifierGroup.create({
                            data: menuModifierGroup
                        })

                        for (const menuItemModifier of menuItemModifiers) {
                            menuItemModifier.menuItemModifierGroupID = newMenuModifierGroup.id
                            const newMenuItemModifier = await tx.menuItemModifier.create({
                                data: menuItemModifier
                            })
                        }
                    }
                }
            }
        })
        return true
    }
    catch (error) {
        throw error
    }
}

let updateMenuProfile = async (menuProfile: MenuProfile) => {
    try {
        const updatedMenuProfile = await prisma.menuProfile.update({
            where: {
                id: menuProfile.id
            },
            data: menuProfile
        })
        return updatedMenuProfile
    }
    catch (error) {
        throw error
    }
}

export = {
    getAllMenuProfiles,
    linkMenuProfileToOutlet,
    getMenuProfilesCountByOutletID,
    getMenuProfilesByOutletID,
    createMenuProfile,
    updateMenuProfile
}