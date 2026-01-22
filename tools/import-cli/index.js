#!/usr/bin/env node

/**
 * Import CLI - Bulk data import tool for POS system
 *
 * Usage:
 *   node index.js validate --file=products.xlsx
 *   node index.js import --file=products.xlsx --direct --tenant-id=123
 *   node index.js import --file=products.xlsx --api=https://api.com --token=xxx
 */

import { program } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { parseExcel, getDataSummary } from './src/parser.js';
import { validate, formatValidationResult } from './src/validator.js';
import { importDirectToDB } from './src/importer-direct.js';
import { importViaApi } from './src/importer-api.js';

// Load environment variables from main project's .env
const __dirname = path.dirname(new URL(import.meta.url).pathname);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Banner
console.log(chalk.cyan(`
╔═══════════════════════════════════════════════╗
║          POS Import CLI Tool v1.0.0           ║
║    Bulk import data from Excel to POS system  ║
╚═══════════════════════════════════════════════╝
`));

program
  .name('import-cli')
  .description('CLI tool for bulk importing data to POS system')
  .version('1.0.0');

// Validate command
program
  .command('validate')
  .description('Validate an Excel file without importing')
  .requiredOption('-f, --file <path>', 'Path to Excel file')
  .action(async (options) => {
    try {
      console.log(chalk.blue(`📂 Parsing file: ${options.file}\n`));

      // Check if file exists
      if (!fs.existsSync(options.file)) {
        console.log(chalk.red(`❌ File not found: ${options.file}`));
        process.exit(1);
      }

      // Parse Excel file
      const data = parseExcel(options.file);

      // Validate data
      console.log(chalk.blue('\n🔍 Validating data...\n'));
      const result = validate(data);

      // Display results
      console.log(formatValidationResult(result));

      if (result.isValid) {
        console.log(chalk.green('\n✅ File is ready for import!'));
        console.log(chalk.gray('   Run: node index.js import --file=' + options.file + ' [options]'));
      } else {
        console.log(chalk.red('\n❌ Please fix the errors above before importing.'));
        process.exit(1);
      }

    } catch (error) {
      console.log(chalk.red(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Import command
program
  .command('import')
  .description('Import data from Excel file')
  .requiredOption('-f, --file <path>', 'Path to Excel file')
  .option('--direct', 'Use direct database mode (requires tenant-id or tenant-name)')
  .option('--tenant-id <id>', 'Tenant ID for direct mode')
  .option('--tenant-name <name>', 'Tenant name for direct mode')
  .option('--api <url>', 'API base URL for API mode')
  .option('--token <token>', 'API authorization token for API mode')
  .option('-b, --batch-size <size>', 'Batch size for imports', '20')
  .option('--outlet-id <id>', 'Default outlet ID for stock', '1')
  .option('--dry-run', 'Validate and preview without actually importing')
  .option('--skip-validation', 'Skip validation step')
  .action(async (options) => {
    try {
      console.log(chalk.blue(`📂 Parsing file: ${options.file}\n`));

      // Check if file exists
      if (!fs.existsSync(options.file)) {
        console.log(chalk.red(`❌ File not found: ${options.file}`));
        process.exit(1);
      }

      // Determine mode
      const isDirectMode = options.direct;
      const isApiMode = options.api && options.token;

      if (!isDirectMode && !isApiMode) {
        console.log(chalk.red('❌ Either --direct (with --tenant-id/--tenant-name) or --api + --token must be specified'));
        console.log(chalk.gray('\nExamples:'));
        console.log(chalk.gray('  Direct DB mode:'));
        console.log(chalk.gray('    node index.js import --file=data.xlsx --direct --tenant-id=123'));
        console.log(chalk.gray('    node index.js import --file=data.xlsx --direct --tenant-name="customer_abc"'));
        console.log(chalk.gray('\n  API mode:'));
        console.log(chalk.gray('    node index.js import --file=data.xlsx --api=https://api.example.com --token=xxx'));
        process.exit(1);
      }

      if (isDirectMode && !options.tenantId && !options.tenantName) {
        console.log(chalk.red('❌ Direct mode requires --tenant-id or --tenant-name'));
        process.exit(1);
      }

      // Parse Excel file
      const data = parseExcel(options.file);
      const summary = getDataSummary(data);

      if (summary.total === 0) {
        console.log(chalk.yellow('\n⚠️  No data found in the Excel file'));
        process.exit(0);
      }

      // Validate data (unless skipped)
      if (!options.skipValidation) {
        console.log(chalk.blue('\n🔍 Validating data...\n'));
        const result = validate(data);
        console.log(formatValidationResult(result));

        if (!result.isValid) {
          console.log(chalk.red('\n❌ Validation failed. Fix errors above or use --skip-validation to force import.'));
          process.exit(1);
        }
      }

      // Import data
      const importOptions = {
        batchSize: parseInt(options.batchSize),
        outletId: parseInt(options.outletId),
        dryRun: options.dryRun,
      };

      let results;

      if (isDirectMode) {
        console.log(chalk.blue('\n🔌 Using Direct Database Mode'));
        results = await importDirectToDB(data, {
          ...importOptions,
          tenantId: options.tenantId ? parseInt(options.tenantId) : null,
          tenantName: options.tenantName || null,
        });
      } else {
        console.log(chalk.blue('\n🌐 Using API Mode'));
        results = await importViaApi(data, {
          ...importOptions,
          apiUrl: options.api,
          token: options.token,
        });
      }

      // Print summary
      if (!options.dryRun) {
        console.log(chalk.green('\n' + '═'.repeat(50)));
        console.log(chalk.green('✅ Import completed successfully!'));
        console.log(chalk.green('═'.repeat(50)));

        if (results.categories) {
          console.log(`   Categories: ${results.categories.created} created, ${results.categories.existing || 0} existing`);
        }
        if (results.suppliers) {
          console.log(`   Suppliers:  ${results.suppliers.created} created, ${results.suppliers.existing || 0} existing`);
        }
        if (results.items) {
          console.log(`   Items:      ${results.items.created} created, ${results.items.existing || 0} existing`);
        }
        if (results.variants) {
          console.log(`   Variants:   ${results.variants.created} created, ${results.variants.existing || 0} existing`);
        }
        if (results.customers) {
          console.log(`   Customers:  ${results.customers.created} created`);
        }
        if (results.stockBalances) {
          console.log(`   Stock:      ${results.stockBalances.created} balances, ${results.stockMovements.created} movements`);
        }
      }

    } catch (error) {
      console.log(chalk.red(`\n❌ Error: ${error.message}`));
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Template command
program
  .command('template')
  .description('Generate an empty Excel template')
  .option('-o, --output <path>', 'Output file path', './import_template.xlsx')
  .action(async (options) => {
    try {
      const templatePath = path.join(path.dirname(new URL(import.meta.url).pathname), 'templates', 'import_template.xlsx');

      if (!fs.existsSync(templatePath)) {
        console.log(chalk.yellow('⚠️  Template file not found. Please check templates/import_template.xlsx'));
        console.log(chalk.gray('\nExpected template location: ' + templatePath));
        process.exit(1);
      }

      fs.copyFileSync(templatePath, options.output);
      console.log(chalk.green(`✅ Template copied to: ${options.output}`));
      console.log(chalk.gray('\nOpen the template and fill in your data, then run:'));
      console.log(chalk.gray(`  node index.js validate --file=${options.output}`));

    } catch (error) {
      console.log(chalk.red(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program.parse();
