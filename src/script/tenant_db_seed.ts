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

async function seedItems(tenantPrisma: any, outletId: number, supplierId: number, categoryId: number, count: number = 200): Promise<void> {
    console.log(`Starting to seed ${count} items...`);

    const itemTypes = ["Electronics", "Furniture", "Clothing", "Food", "Accessories", "Books"];
    const brands = ["TechGiant", "HomeComfort", "FashionX", "GourmetDelight", "AccessoryPlus", "KnowledgePress"];
    const unitOptions = ["pcs", "kg", "dozen", "box", "set", "pair"];

    const items = [];

    for (let i = 1; i <= count; i++) {
        // Generate padded item code
        const itemCode = `ITEM${i.toString().padStart(4, '0')}`;

        const cost = getRandomRoundNumber();
        const price = getRandomPriceBasedOnCost(cost);

        items.push({
            itemCode,
            itemName: `Product ${i}`,
            itemType: getRandomElement(itemTypes),
            itemModel: `Model ${String.fromCharCode(65 + (i % 26))}${getRandomInt(1, 99)}`,
            itemBrand: getRandomElement(brands),
            itemDescription: `This is a detailed description for product ${i}. It includes features and specifications.`,
            cost,
            price,
            isOpenPrice: i % 10 === 0, // Every 10th item has open price
            unitOfMeasure: getRandomElement(unitOptions),
            height: getRandomFloat(1, 50),
            width: getRandomFloat(1, 30),
            length: getRandomFloat(1, 40),
            weight: getRandomFloat(0.1, 10, 1),
            alternateLookUp: `ALT${i.toString().padStart(4, '0')}`,
            image: `https://example.com/images/product_${i}.jpg`,
            deleted: false,
            stockBalance: {
                create: {
                    outletId,
                    availableQuantity: getRandomInt(0, 100),
                    onHandQuantity: getRandomInt(0, 100),
                    deleted: false,
                },
            },
            stockMovement: {
                create: [
                    {
                        previousAvailableQuantity: getRandomInt(0, 100),
                        previousOnHandQuantity: getRandomInt(0, 100),
                        availableQuantityDelta: getRandomInt(1, 10),
                        onHandQuantityDelta: getRandomInt(1, 10),
                        documentId: i,
                        movementType: "Create Item",
                        reason: "",
                        remark: "",
                        outletId,
                        deleted: false
                    }
                ]
            },
            supplier: {
                connect: { id: supplierId }
            },
            category: {
                connect: { id: categoryId },
            }
        });
    }

    // Using createMany for bulk insertion if schema supports it
    // If relationships require individual creation, we'll use a loop instead
    try {
        for (let i = 0; i < items.length; i++) {
            await tenantPrisma.item.create({ data: items[i] });
            if (i % 10 === 0) {
                console.log(`Created ${i} items...`);
            }
        }
        console.log(`Successfully created ${count} items`);
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