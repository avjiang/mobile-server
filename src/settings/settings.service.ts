import { PrismaClient as TenantPrismaClient, Setting } from "../../prisma/client/generated/client";
import { PrismaClient as GlobalPrismaClient, SettingDefinition } from "../../prisma/global-client/generated/global";
import { getTenantPrisma, getGlobalPrisma } from "../db";
import { NotFoundError, RequestValidateError } from "../api-helpers/error";
import { SyncSettingsRequest, UpdateSettingRequest, SettingsResponse, SettingWithDefinition } from "./settings.request";

// Cache for setting definitions (refresh every 5 minutes)
let definitionsCache: SettingDefinition[] = [];
let lastCacheUpdate: Date = new Date(0);
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Load setting definitions from global DB and cache them
 */
async function loadSettingDefinitions(forceRefresh: boolean = false): Promise<SettingDefinition[]> {
    const now = new Date();
    const cacheExpired = now.getTime() - lastCacheUpdate.getTime() > CACHE_TTL_MS;

    if (definitionsCache.length === 0 || cacheExpired || forceRefresh) {
        const globalPrisma = getGlobalPrisma();
        definitionsCache = await globalPrisma.settingDefinition.findMany({
            where: { deleted: false },
            orderBy: [{ category: 'asc' }, { key: 'asc' }]
        });
        lastCacheUpdate = now;
    }

    return definitionsCache;
}

/**
 * Get all settings with delta sync support (similar to sales.service.ts)
 */
let getAll = async (
    databaseName: string,
    tenantId: number,
    request: SyncSettingsRequest
): Promise<SettingsResponse> => {
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

        // Load definitions from cache
        const definitions = await loadSettingDefinitions();

        // Build query conditions with delta sync
        const where: any = {
            deleted: false,
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

        // Enrich settings with definitions
        const enrichedSettings: SettingWithDefinition[] = settings.map(setting => {
            const definition = definitions.find(d => d.id === setting.settingDefinitionId);
            return {
                ...setting,
                definition
            };
        });

        return {
            settings: enrichedSettings,
            definitions: definitions, // Send all definitions for Flutter to cache
            total,
            serverTimestamp: new Date().toISOString()
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Update a single setting
 */
let update = async (
    databaseName: string,
    tenantId: number,
    request: UpdateSettingRequest
): Promise<Setting> => {
    const tenantPrisma: TenantPrismaClient = getTenantPrisma(databaseName);
    const { key, value, outletId, userId } = request;

    try {
        // Load definitions to get the setting metadata
        const definitions = await loadSettingDefinitions();
        const definition = definitions.find(d => d.key === key);

        if (!definition) {
            throw new NotFoundError(`Setting definition with key '${key}'`);
        }

        // Validate value based on type
        validateSettingValue(definition, value);

        // Determine scope values based on definition
        const scopeData = {
            tenantId: definition.scope === 'TENANT' ? tenantId : null,
            outletId: definition.scope === 'OUTLET' ? outletId || null : null,
            userId: definition.scope === 'USER' ? userId || null : null
        };

        // Validate required scope parameters
        if (definition.scope === 'OUTLET' && !outletId) {
            throw new RequestValidateError(`outletId is required for setting '${key}'`);
        }
        if (definition.scope === 'USER' && !userId) {
            throw new RequestValidateError(`userId is required for setting '${key}'`);
        }

        // Find existing setting
        const existingSetting = await tenantPrisma.setting.findFirst({
            where: {
                settingDefinitionId: definition.id,
                tenantId: scopeData.tenantId,
                outletId: scopeData.outletId,
                userId: scopeData.userId,
                deleted: false
            }
        });

        let setting: Setting;

        if (existingSetting) {
            // Update existing setting
            setting = await tenantPrisma.setting.update({
                where: { id: existingSetting.id },
                data: {
                    value,
                    updatedAt: new Date()
                }
            });
        } else {
            // Create new setting
            setting = await tenantPrisma.setting.create({
                data: {
                    settingDefinitionId: definition.id,
                    value,
                    ...scopeData
                }
            });
        }

        return setting;
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

export = {
    getAll,
    update,
    loadSettingDefinitions // For app initialization
};
