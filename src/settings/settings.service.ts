import { PrismaClient as TenantPrismaClient, Setting } from "../../prisma/client/generated/client";
import { PrismaClient as GlobalPrismaClient, SettingDefinition } from "../../prisma/global-client/generated/global";
import { getTenantPrisma, getGlobalPrisma } from "../db";
import { NotFoundError, RequestValidateError } from "../api-helpers/error";
import { SyncSettingsRequest, UpdateSettingRequest } from "./settings.request";

/**
 * Get all settings with delta sync support (similar to sales.service.ts)
 */
let getAllSettings = async (
    databaseName: string,
    tenantId: number,
    request: SyncSettingsRequest
): Promise<{ settings: Setting[]; total: number; serverTimestamp: string }> => {
    const tenantPrisma: TenantPrismaClient = getTenantPrisma(databaseName);
    const { lastSyncTimestamp, outletId, userId, skip = 0, take = 100 } = request;

    try {
        // Parse last sync timestamp (same pattern as sales service)
        let lastSync: Date;

        if (lastSyncTimestamp && lastSyncTimestamp !== 'null') {
            lastSync = new Date(lastSyncTimestamp);
        } else {
            // Initial sync - get all settings
            lastSync = new Date(0);
        }

        // Build query conditions with delta sync
        const where: any = {
            OR: [
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } },
                { deletedAt: { gte: lastSync } }
            ]
        };

        // Optional filters
        if (outletId) {
            where.outletId = outletId;
        }
        if (userId) {
            where.userId = userId;
        }

        // Count total
        const total = await tenantPrisma.setting.count({ where });

        // Fetch settings with pagination
        const settings = await tenantPrisma.setting.findMany({
            where,
            skip,
            take,
            orderBy: [
                { updatedAt: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        return {
            settings,
            total,
            serverTimestamp: new Date().toISOString()
        };
    } catch (error) {
        throw error;
    }
};


/**
 * Get all setting definitions from global DB with delta sync support
 */
let getAllSettingDefinitions = async (
    lastSyncTimestamp?: string,
    skip: number = 0,
    take: number = 100
): Promise<{ definitions: SettingDefinition[]; total: number; serverTimestamp: string }> => {
    const globalPrisma: GlobalPrismaClient = getGlobalPrisma();

    try {
        // Parse last sync timestamp (same pattern as getAllSettings)
        let lastSync: Date;

        if (lastSyncTimestamp && lastSyncTimestamp !== 'null') {
            lastSync = new Date(lastSyncTimestamp);
        } else {
            // Initial sync - get all definitions
            lastSync = new Date(0);
        }

        // Build query conditions with delta sync
        const where: any = {
            OR: [
                { createdAt: { gte: lastSync } },
                { updatedAt: { gte: lastSync } },
                { deletedAt: { gte: lastSync } }
            ]
        };

        // Count total
        const total = await globalPrisma.settingDefinition.count({ where });

        // Fetch definitions with pagination
        const definitions = await globalPrisma.settingDefinition.findMany({
            where,
            skip,
            take,
            orderBy: [
                { updatedAt: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        return {
            definitions,
            total,
            serverTimestamp: new Date().toISOString()
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Validate setting value against definition
 */
function validateSettingValue(definition: SettingDefinition, value: string): void {
    // Type validation
    switch (definition.type) {
        case 'INT':
            if (!/^-?\d+$/.test(value)) {
                throw new RequestValidateError(`Value must be an integer for setting '${definition.key}'`);
            }
            break;
        case 'DOUBLE':
            if (!/^-?\d+(\.\d+)?$/.test(value)) {
                throw new RequestValidateError(`Value must be a number for setting '${definition.key}'`);
            }
            break;
        case 'BOOLEAN':
            if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
                throw new RequestValidateError(`Value must be a boolean for setting '${definition.key}'`);
            }
            break;
        case 'JSON':
            try {
                JSON.parse(value);
            } catch (e) {
                throw new RequestValidateError(`Value must be valid JSON for setting '${definition.key}'`);
            }
            break;
    }

    // Custom validation rules
    if (definition.validationRules) {
        try {
            const rules = JSON.parse(definition.validationRules);

            if (rules.options && Array.isArray(rules.options)) {
                if (!rules.options.includes(value)) {
                    throw new RequestValidateError(
                        `Value must be one of: ${rules.options.join(', ')} for setting '${definition.key}'`
                    );
                }
            }

            // Min/max validation for INT and DOUBLE types
            if (definition.type === 'INT' || definition.type === 'DOUBLE') {
                const numValue = definition.type === 'INT' ? parseInt(value) : parseFloat(value);
                if (rules.min !== undefined && numValue < rules.min) {
                    throw new RequestValidateError(`Value must be at least ${rules.min} for setting '${definition.key}'`);
                }
                if (rules.max !== undefined && numValue > rules.max) {
                    throw new RequestValidateError(`Value must be at most ${rules.max} for setting '${definition.key}'`);
                }
            }

            if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
                throw new RequestValidateError(`Value does not match required pattern for setting '${definition.key}'`);
            }
        } catch (e) {
            if (e instanceof RequestValidateError) throw e;
        }
    }
}

/**
 * Batch update/create settings with validation (optimized with upsert support)
 */
let batchUpdateSettings = async (
    databaseName: string,
    tenantId: number,
    updates: UpdateSettingRequest[]
): Promise<{ updated: Setting[]; serverTimestamp: string }> => {
    const tenantPrisma: TenantPrismaClient = getTenantPrisma(databaseName);
    const globalPrisma: GlobalPrismaClient = getGlobalPrisma();

    try {
        // Separate updates into existing (with ID) and new (without ID or null ID)
        const existingUpdates = updates.filter(u => u.id != null); // Filters out both null and undefined
        const newUpdates = updates.filter(u => u.id == null); // Catches both null and undefined

        // Validate new updates have required fields
        for (const update of newUpdates) {
            if (!update.settingDefinitionId) {
                throw new RequestValidateError('settingDefinitionId is required when creating new settings');
            }
        }

        // Extract all setting IDs for existing settings
        const settingIds = existingUpdates.map(u => u.id!);

        // Extract all definition IDs (from both existing and new)
        const definitionIdsFromExisting = existingUpdates.length > 0
            ? (await tenantPrisma.setting.findMany({
                where: { id: { in: settingIds } },
                select: { settingDefinitionId: true }
            })).map(s => s.settingDefinitionId)
            : [];

        const definitionIdsFromNew = newUpdates.map(u => u.settingDefinitionId!);
        const allDefinitionIds = [...new Set([...definitionIdsFromExisting, ...definitionIdsFromNew])];

        // Bulk fetch all definitions for validation
        const definitions = await globalPrisma.settingDefinition.findMany({
            where: { id: { in: allDefinitionIds } }
        });

        const definitionsMap = new Map(definitions.map(d => [d.id, d]));

        // Bulk fetch existing settings if there are updates
        let existingSettingsMap = new Map<number, Setting>();
        if (settingIds.length > 0) {
            const existingSettings = await tenantPrisma.setting.findMany({
                where: { id: { in: settingIds } }
            });
            existingSettingsMap = new Map(existingSettings.map(s => [s.id, s]));

            // Check if all settings exist
            for (const update of existingUpdates) {
                if (!existingSettingsMap.has(update.id!)) {
                    throw new NotFoundError(`Setting with ID ${update.id} not found`);
                }
            }
        }

        // Validate all updates
        for (const update of existingUpdates) {
            const setting = existingSettingsMap.get(update.id!)!;
            const definition = definitionsMap.get(setting.settingDefinitionId);

            if (!definition) {
                throw new NotFoundError(`Setting definition not found for setting ID ${update.id}`);
            }

            validateSettingValue(definition, update.value);
        }

        for (const update of newUpdates) {
            const definition = definitionsMap.get(update.settingDefinitionId!);

            if (!definition) {
                throw new NotFoundError(`Setting definition with ID ${update.settingDefinitionId} not found`);
            }

            validateSettingValue(definition, update.value);
        }

        // Perform batch operations using transaction
        const now = new Date();
        const result = await tenantPrisma.$transaction(async (tx) => {
            const updated: Setting[] = [];

            // Update existing settings
            for (const update of existingUpdates) {
                const updatedSetting = await tx.setting.update({
                    where: { id: update.id! },
                    data: {
                        value: update.value,
                        updatedAt: now,
                        version: {
                            increment: 1
                        }
                    }
                });
                updated.push(updatedSetting);
            }

            // Create new settings
            for (const update of newUpdates) {
                const newSetting = await tx.setting.create({
                    data: {
                        settingDefinitionId: update.settingDefinitionId!,
                        tenantId: update.tenantId,
                        userId: update.userId,
                        outletId: update.outletId,
                        value: update.value,
                        createdAt: now,
                        updatedAt: now,
                        version: 1
                    }
                });
                updated.push(newSetting);
            }

            return updated;
        });

        return {
            updated: result,
            serverTimestamp: now.toISOString()
        };
    } catch (error) {
        throw error;
    }
};

export = {
    getAllSettings,
    getAllSettingDefinitions,
    batchUpdateSettings
};
