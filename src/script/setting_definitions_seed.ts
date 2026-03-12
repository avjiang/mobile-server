import { getGlobalPrisma, disconnectAllPrismaClients } from '../db';

const settingDefinitions = [
    // ============================================
    // FINANCIAL SETTINGS (OUTLET scope)
    // ============================================
    // {
    //     key: 'default_currency',
    //     category: 'Financial',
    //     type: 'STRING',
    //     defaultValue: 'IDR',
    //     description: 'Default currency for transactions',
    //     scope: 'OUTLET',
    //     isRequired: true,
    //     validationRules: JSON.stringify({
    //         options: ['IDR', 'USD', 'SGD', 'MYR', 'THB', 'EUR', 'AUD']
    //     })
    // },
    {
        key: 'tax_rate',
        category: 'Financial',
        type: 'DOUBLE',
        defaultValue: '11',
        description: 'Default tax rate percentage (PPN)',
        scope: 'OUTLET',
        isRequired: true,
        validationRules: JSON.stringify({
            min: 0,
            max: 100
        })
    },
    {
        key: 'tax_inclusive',
        category: 'Financial',
        type: 'BOOLEAN',
        defaultValue: 'true',
        description: 'Whether prices include tax by default',
        scope: 'OUTLET',
        isRequired: false
    },
    {
        key: 'service_charge_rate',
        category: 'Financial',
        type: 'DOUBLE',
        defaultValue: '0',
        description: 'Service charge rate percentage',
        scope: 'OUTLET',
        isRequired: false,
        isReadOnly: false,
        validationRules: '{"min": 0, "max": 100}',
    },
    {
        key: 'service_charge_enabled',
        category: 'Financial',
        type: 'BOOLEAN',
        defaultValue: 'false',
        description: 'Enable service charge on transactions',
        scope: 'OUTLET',
        isRequired: false,
        isReadOnly: false,
        validationRules: null,
    },
    {
        key: 'service_charge_applies_to',
        category: 'Financial',
        type: 'STRING',
        defaultValue: 'all',
        description: 'Sales types for service charge (all, walk_in, delivery)',
        scope: 'OUTLET',
        isRequired: false,
        isReadOnly: false,
        validationRules: '{"options": ["all", "walk_in", "delivery"]}',
    },
    // {
    //     key: 'enable_discount',
    //     category: 'Financial',
    //     type: 'BOOLEAN',
    //     defaultValue: 'true',
    //     description: 'Allow discounts on transactions',
    //     scope: 'OUTLET',
    //     isRequired: false
    // },
    // {
    //     key: 'payment_terms',
    //     category: 'Financial',
    //     type: 'INT',
    //     defaultValue: '30',
    //     description: 'Default payment terms in days',
    //     scope: 'TENANT',
    //     isRequired: false,
    //     validationRules: JSON.stringify({
    //         min: 0,
    //         max: 365
    //     })
    // },

    // ============================================
    // POS SETTINGS (USER scope)
    // ============================================
    {
        key: 'auto_print_receipt',
        category: 'POS',
        type: 'BOOLEAN',
        defaultValue: 'true',
        description: 'Automatically print receipt after sale',
        scope: 'USER',
        isRequired: false
    },
    {
        key: 'receipt_copies',
        category: 'POS',
        type: 'INT',
        defaultValue: '1',
        description: 'Number of receipt copies to print',
        scope: 'USER',
        isRequired: false,
        validationRules: JSON.stringify({
            min: 1,
            max: 5
        })
    },
    {
        key: 'connected_printer',
        category: 'POS',
        type: 'STRING',
        defaultValue: null,
        description: 'Connected Bluetooth printer name',
        scope: 'USER',
        isRequired: false,
        isReadOnly: true,
        validationRules: null
    },
    // {
    //     key: 'enable_barcode_scanner',
    //     category: 'POS',
    //     type: 'BOOLEAN',
    //     defaultValue: 'true',
    //     description: 'Enable barcode scanner for product lookup',
    //     scope: 'OUTLET',
    //     isRequired: false
    // },
    // {
    //     key: 'pos_layout',
    //     category: 'POS',
    //     type: 'STRING',
    //     defaultValue: 'grid',
    //     description: 'POS product display layout',
    //     scope: 'USER',
    //     isRequired: false,
    //     validationRules: JSON.stringify({
    //         options: ['grid', 'list', 'compact']
    //     })
    // },

    // ============================================
    // INVENTORY SETTINGS (OUTLET scope)
    // ============================================
    {
        key: 'low_stock_threshold',
        category: 'Inventory',
        type: 'INT',
        defaultValue: '10',
        description: 'Alert when stock falls below this quantity',
        scope: 'OUTLET',
        isRequired: false,
        validationRules: JSON.stringify({
            min: 0,
            max: 1000
        })
    },
    // {
    //     key: 'enable_stock_alert',
    //     category: 'Inventory',
    //     type: 'BOOLEAN',
    //     defaultValue: 'true',
    //     description: 'Enable low stock notifications',
    //     scope: 'OUTLET',
    //     isRequired: false
    // },
    // {
    //     key: 'auto_reorder',
    //     category: 'Inventory',
    //     type: 'BOOLEAN',
    //     defaultValue: 'false',
    //     description: 'Automatically create purchase orders when stock is low',
    //     scope: 'OUTLET',
    //     isRequired: false
    // },

    // ============================================
    // USER PREFERENCES (USER scope)
    // ============================================
    {
        key: 'language',
        category: 'User Preference',
        type: 'STRING',
        defaultValue: 'en',
        description: 'Preferred language',
        scope: 'USER',
        isRequired: false,
        validationRules: JSON.stringify({
            options: ['en', 'id']
        })
    },
    // {
    //     key: 'theme',
    //     category: 'User Preference',
    //     type: 'STRING',
    //     defaultValue: 'light',
    //     description: 'UI theme preference',
    //     scope: 'USER',
    //     isRequired: false,
    //     validationRules: JSON.stringify({
    //         options: ['light', 'dark', 'auto']
    //     })
    // },
    // {
    //     key: 'notifications_enabled',
    //     category: 'User Preference',
    //     type: 'BOOLEAN',
    //     defaultValue: 'true',
    //     description: 'Enable push notifications',
    //     scope: 'USER',
    //     isRequired: false
    // },
    {
        key: 'is_pushy_registered',
        category: 'User Preference',
        type: 'BOOLEAN',
        defaultValue: 'false',
        description: 'Push notification registration status',
        scope: 'USER',
        isRequired: false,
        isReadOnly: true,
        validationRules: null
    },
    {
        key: 'date_format',
        category: 'User Preference',
        type: 'STRING',
        defaultValue: 'DD/MM/YYYY',
        description: 'Preferred date format',
        scope: 'USER',
        isRequired: false,
        validationRules: JSON.stringify({
            options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']
        })
    },

    // ============================================
    // SYSTEM SETTINGS (TENANT scope)
    // ============================================
    {
        key: 'company_name',
        category: 'System',
        type: 'STRING',
        defaultValue: 'My Company',
        description: 'Company name for invoices and receipts',
        scope: 'TENANT',
        isRequired: true
    },
    {
        key: 'receipt_footer',
        category: 'System',
        type: 'STRING',
        defaultValue: 'Thank you for your business!',
        description: 'Footer text on receipts',
        scope: 'TENANT',
        isRequired: false
    },
    // {
    //     key: 'invoice_prefix',
    //     category: 'System',
    //     type: 'STRING',
    //     defaultValue: 'INV',
    //     description: 'Prefix for invoice numbers',
    //     scope: 'TENANT',
    //     isRequired: false,
    //     validationRules: JSON.stringify({
    //         pattern: '^[A-Z]{2,5}$'
    //     })
    // }
];

export async function seedSettingDefinitions(): Promise<void> {
    const globalPrisma = getGlobalPrisma();

    console.log('Seeding setting definitions...');

    for (const def of settingDefinitions) {
        await globalPrisma.settingDefinition.upsert({
            where: { key: def.key },
            update: def,
            create: def
        });
    }

    console.log(`Successfully seeded ${settingDefinitions.length} setting definitions`);

    // Display summary
    const byScope = settingDefinitions.reduce((acc, def) => {
        acc[def.scope] = (acc[def.scope] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const byCategory = settingDefinitions.reduce((acc, def) => {
        acc[def.category] = (acc[def.category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    console.log('\nSummary:');
    console.log('By Scope:', byScope);
    console.log('By Category:', byCategory);
}

// Run if executed directly
if (require.main === module) {
    seedSettingDefinitions()
        .catch((error) => {
            console.error('Error seeding setting definitions:', error);
            process.exit(1);
        })
        .finally(() => disconnectAllPrismaClients());
}
