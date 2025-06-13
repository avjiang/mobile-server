import { PrismaClient } from ".prisma/global-client";
import bcrypt from "bcryptjs"
import { getTenantPrisma, initializeTenantDatabase } from '../db';

// Helper functions for generating random item data
function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Add these functions for generating round numbers
function getRandomRoundNumber(): number {
    // Generate numbers between 25,000 and 500,000
    const min = 25000;
    const max = 500000;
    const step = 5000;

    // Calculate a random multiple of 5000
    const steps = Math.floor((max - min) / step) + 1;
    return min + (Math.floor(Math.random() * steps) * step);
}

function getRandomPriceBasedOnCost(cost: number): number {
    // Generate a price that's 1.1x to 2.0x the cost, rounded to nearest 5000
    const minMultiplier = 1.1;
    const maxMultiplier = 2.0;

    const multiplier = minMultiplier + Math.random() * (maxMultiplier - minMultiplier);
    const exactPrice = cost * multiplier;

    // Round to nearest 5000
    return Math.ceil(exactPrice / 5000) * 5000;
}

function getRandomFloat(min: number, max: number, decimals: number = 2): number {
    const value = Math.random() * (max - min) + min;
    return parseFloat(value.toFixed(decimals));
}

function getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function generateCode(str: string, length: number = 4): string {
    return str
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, length)
        .toUpperCase()
        .padEnd(length, 'X');
}

async function seedItems(tenantPrisma: any, outletId: number, supplierId: number, categoryId: number, count: number = 200): Promise<void> {
    console.log(`Starting to seed ${count} items...`);

    const itemTypes = ["Electronics", "Furniture", "Clothing", "Food", "Accessories", "Books"];
    const brands = ["TechGiant", "HomeComfort", "FashionX", "GourmetDelight", "AccessoryPlus", "KnowledgePress"];
    const unitOptions = ["pcs", "kg", "dozen", "box", "set", "pair"];

    try {
        // Fetch category name for SKU generation
        const category = await tenantPrisma.category.findUnique({
            where: { id: categoryId },
            select: { name: true }
        });

        if (!category) {
            throw new Error(`Category with ID ${categoryId} not found`);
        }

        const categoryCode = generateCode(category.name);

        // Pre-count existing items by brand to generate proper SKUs
        const brandCounts = new Map<string, number>();

        for (const brand of brands) {
            const count = await tenantPrisma.item.count({
                where: {
                    categoryId,
                    itemBrand: brand,
                    deleted: false,
                },
            });
            brandCounts.set(brand, count);
        }

        const items = [];

        for (let i = 1; i <= count; i++) {
            const itemCode = `ITEM${i.toString().padStart(4, '0')}`;
            const cost = getRandomRoundNumber();
            const price = getRandomPriceBasedOnCost(cost);
            const selectedBrand = getRandomElement(brands);

            // Generate SKU
            const brandCode = generateCode(selectedBrand);
            const currentCount = brandCounts.get(selectedBrand) || 0;
            brandCounts.set(selectedBrand, currentCount + 1);
            const sequentialNumber = currentCount.toString().padStart(4, '0');
            const sku = `${categoryCode}-${brandCode}-${sequentialNumber}`;

            const availableQuantity = getRandomInt(0, 100);
            const onHandQuantity = availableQuantity;

            items.push({
                itemCode,
                itemName: `Product ${i}`,
                itemType: getRandomElement(itemTypes),
                itemModel: `Model ${String.fromCharCode(65 + (i % 26))}${getRandomInt(1, 99)}`,
                itemBrand: selectedBrand,
                itemDescription: `This is a detailed description for product ${i}. It includes features and specifications.`,
                cost,
                price,
                sku, // Add the generated SKU
                isOpenPrice: i % 10 === 0,
                unitOfMeasure: getRandomElement(unitOptions),
                height: getRandomFloat(1, 50),
                width: getRandomFloat(1, 30),
                length: getRandomFloat(1, 40),
                weight: getRandomFloat(0.1, 10, 1),
                alternateLookUp: `ALT${i.toString().padStart(4, '0')}`,
                image: `https://example.com/images/product_${i}.jpg`,
                deleted: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 1,
                stockBalance: {
                    create: {
                        outletId,
                        availableQuantity,
                        onHandQuantity,
                        deleted: false,
                    },
                },
                stockMovements: {
                    create: {
                        previousAvailableQuantity: 0,
                        previousOnHandQuantity: 0,
                        availableQuantityDelta: availableQuantity,
                        onHandQuantityDelta: onHandQuantity,
                        documentId: i,
                        movementType: "Create Item",
                        reason: "",
                        remark: "",
                        outletId,
                        deleted: false
                    }
                },
                stockReceipts: {
                    create: [{
                        outletId,
                        quantity: availableQuantity,
                        cost,
                        deleted: false,
                    }]
                },
                supplier: {
                    connect: { id: supplierId }
                },
                category: {
                    connect: { id: categoryId },
                }
            });
        }

        // Create items individually (required for nested relations)
        for (let i = 0; i < items.length; i++) {
            await tenantPrisma.item.create({ data: items[i] });
            if (i % 10 === 0) {
                console.log(`Created ${i} items...`);
            }
        }
        console.log(`Successfully created ${count} items with SKUs`);
    } catch (error) {
        console.error("Error creating items:", error);
        throw error;
    }
}

async function main(): Promise<void> {
    const tenantPrisma1 = getTenantPrisma('web_bytes_db');
    try {
        // Seed 200 items
        await seedItems(tenantPrisma1, 1, 1, 1, 200);

        console.log("Seeding completed successfully!");
    } catch (error) {
        console.error("Error during seeding:", error);
        process.exit(1);
    } finally {
        // Close the Prisma client connection
        await tenantPrisma1.$disconnect();
    }
}

// Execute the seeding
main()
    .catch((error) => {
        console.error("Seeding failed:", error);
        process.exit(1);
    });