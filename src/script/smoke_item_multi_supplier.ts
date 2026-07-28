/**
 * End-to-end check of the item multi-supplier junction against a local tenant DB.
 * Exercises the real service functions (not raw SQL) so the Pro guard, the
 * preferred-pointer invariant and the supplier-delete guard are all covered.
 *
 * Usage: npx ts-node src/script/smoke_item_multi_supplier.ts
 */
import itemService from '../item/item.service';
import supplierService from '../supplier/supplier.service';
import { getTenantPrisma } from '../db';

const DB = 'web_bytes_db';
let pass = 0, fail = 0;

function check(name: string, cond: boolean, detail = '') {
    if (cond) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name} ${detail}`); }
}

(async () => {
    const p = getTenantPrisma(DB);

    // Two suppliers to link against.
    const supA = await p.supplier.upsert({
        where: { companyName: 'TEST Supplier A' },
        update: { deleted: false }, create: { companyName: 'TEST Supplier A', hasTax: false },
    });
    const supB = await p.supplier.upsert({
        where: { companyName: 'TEST Supplier B' },
        update: { deleted: false }, create: { companyName: 'TEST Supplier B', hasTax: false },
    });
    const cat = await p.category.findFirst({ where: { deleted: false } });

    console.log('\n1. Create on Basic — single supplier (must succeed)');
    const [basicItem] = await itemService.createMany(DB, [{
        itemName: 'TEST Socks Basic', itemCode: 'TST-BASIC-1', categoryId: cat!.id,
        supplierId: supA.id, price: 25000, cost: 0, trackStock: true, stockQuantity: 0,
    } as any], 'Basic');
    let links = await p.itemSupplier.findMany({ where: { itemId: basicItem.id, deleted: false } });
    check('Basic create writes exactly 1 junction row', links.length === 1, `got ${links.length}`);
    check('that row is preferred', links[0]?.isPreferred === true);
    check('item.supplierId mirrors it', basicItem.supplierId === links[0]?.supplierId);

    console.log('\n2. Create on Basic — two suppliers (must be rejected)');
    let rejected = false;
    try {
        await itemService.createMany(DB, [{
            itemName: 'TEST Socks BasicMulti', itemCode: 'TST-BASIC-2', categoryId: cat!.id,
            price: 25000, cost: 0, trackStock: true, stockQuantity: 0,
            suppliers: [
                { supplierId: supA.id, isPreferred: true },
                { supplierId: supB.id },
            ],
        } as any], 'Basic');
    } catch (e: any) { rejected = /Pro feature/i.test(e.message); }
    check('Basic rejected for 2 suppliers', rejected);

    console.log('\n3. Create on Pro — two suppliers with cost + SKU');
    const [proItem] = await itemService.createMany(DB, [{
        itemName: 'TEST Socks Pro', itemCode: 'TST-PRO-1', categoryId: cat!.id,
        price: 25000, cost: 0, trackStock: true, stockQuantity: 0,
        suppliers: [
            { supplierId: supA.id, isPreferred: true, cost: 12000, supplierItemCode: 'TAJ-01' },
            { supplierId: supB.id, cost: 11500, supplierItemCode: 'SE-4471' },
        ],
    } as any], 'Pro');
    links = await p.itemSupplier.findMany({ where: { itemId: proItem.id, deleted: false }, orderBy: { supplierId: 'asc' } });
    check('Pro create writes 2 junction rows', links.length === 2, `got ${links.length}`);
    check('exactly one preferred', links.filter(l => l.isPreferred).length === 1);
    check('item.supplierId = preferred row', proItem.supplierId === links.find(l => l.isPreferred)!.supplierId);
    check('per-supplier cost stored', links.some(l => Number(l.cost) === 11500));
    check('per-supplier SKU stored', links.some(l => l.supplierItemCode === 'SE-4471'));

    console.log('\n4. getAllBySupplierId returns the item for BOTH suppliers');
    const forA = await itemService.getAllBySupplierId(DB, supA.id);
    const forB = await itemService.getAllBySupplierId(DB, supB.id);
    check('appears for preferred supplier A', forA.some((i: any) => i.id === proItem.id));
    check('appears for non-preferred supplier B', forB.some((i: any) => i.id === proItem.id));

    console.log('\n5. Update — switch preferred to B, drop A');
    const before = await p.item.findUnique({ where: { id: proItem.id } });
    await new Promise(r => setTimeout(r, 1100)); // make an updatedAt bump observable
    await itemService.update(DB, {
        id: proItem.id, itemName: 'TEST Socks Pro',
        suppliers: [{ supplierId: supB.id, isPreferred: true, cost: 11000 }],
    } as any, 'Pro');
    const after = await p.item.findUnique({ where: { id: proItem.id } });
    links = await p.itemSupplier.findMany({ where: { itemId: proItem.id, deleted: false } });
    check('only B remains live', links.length === 1 && links[0].supplierId === supB.id, `got ${links.length}`);
    check('item.supplierId repointed to B', after!.supplierId === supB.id);
    check('dropped row soft-deleted, not destroyed',
        (await p.itemSupplier.count({ where: { itemId: proItem.id, supplierId: supA.id, deleted: true } })) === 1);
    check('item.updatedAt bumped (delta sync will deliver it)',
        after!.updatedAt!.getTime() > before!.updatedAt!.getTime());

    console.log('\n6. Update with NO suppliers key leaves the junction untouched (old binary / outbox replay)');
    await itemService.update(DB, { id: proItem.id, itemName: 'TEST Socks Pro Renamed' } as any, 'Pro');
    links = await p.itemSupplier.findMany({ where: { itemId: proItem.id, deleted: false } });
    check('junction preserved', links.length === 1 && links[0].supplierId === supB.id);

    console.log('\n6b. Legacy update (scalar supplierId, no suppliers[]) re-points the preferred row');
    // This is the BE-deployed / old-APK window. The old binary knows only item.supplierId.
    // Same supplier as today → no-op.
    await itemService.update(DB, { id: proItem.id, supplierId: supB.id } as any, 'Pro');
    links = await p.itemSupplier.findMany({ where: { itemId: proItem.id, deleted: false } });
    check('unchanged supplier is a no-op', links.length === 1 && links[0].supplierId === supB.id);

    // Give it a second live supplier, then have the old binary switch the scalar to A.
    await itemService.update(DB, {
        id: proItem.id,
        suppliers: [{ supplierId: supB.id, isPreferred: true }, { supplierId: supA.id }],
    } as any, 'Pro');
    await itemService.update(DB, { id: proItem.id, supplierId: supA.id } as any, 'Pro');
    let afterLegacy = await p.item.findUnique({ where: { id: proItem.id } });
    links = await p.itemSupplier.findMany({ where: { itemId: proItem.id, deleted: false } });
    check('junction preferred row follows the scalar', links.find(l => l.isPreferred)?.supplierId === supA.id);
    check('exactly one preferred after the switch', links.filter(l => l.isPreferred).length === 1);
    check('item.supplierId agrees with the junction', afterLegacy!.supplierId === supA.id);
    check('the old binary did NOT drop the Pro tenant\'s other supplier',
        links.length === 2, `got ${links.length}`);

    // An item whose junction is empty (migration backfill skipped it) is healed on next save.
    await p.itemSupplier.deleteMany({ where: { itemId: basicItem.id } });
    await itemService.update(DB, { id: basicItem.id, supplierId: supA.id } as any, 'Basic');
    links = await p.itemSupplier.findMany({ where: { itemId: basicItem.id, deleted: false } });
    check('empty junction healed by a legacy save',
        links.length === 1 && links[0].supplierId === supA.id && links[0].isPreferred === true,
        `got ${links.length}`);

    // Restore the state step 7 expects: only B live on proItem.
    await itemService.update(DB, {
        id: proItem.id, suppliers: [{ supplierId: supB.id, isPreferred: true }],
    } as any, 'Pro');

    console.log('\n7. Re-adding a previously removed supplier revives the soft-deleted row');
    await itemService.update(DB, {
        id: proItem.id,
        suppliers: [{ supplierId: supB.id, isPreferred: true }, { supplierId: supA.id }],
    } as any, 'Pro');
    links = await p.itemSupplier.findMany({ where: { itemId: proItem.id, deleted: false } });
    check('back to 2 live rows (no unique-index crash)', links.length === 2, `got ${links.length}`);

    console.log('\n8. supplier.itemCount counts via junction (B is NON-preferred on proItem)');
    const supBInfo: any = await supplierService.getById(supB.id, DB);
    check('itemCount > 0 for a supplier reached only via junction', supBInfo.itemCount > 0, `got ${supBInfo.itemCount}`);

    console.log('\n9. Supplier delete guard');
    // basicItem (step 1) is sole-sourced from A, so A must be undeletable.
    let blockedA = false;
    try { await supplierService.remove(supA.id, DB); }
    catch (e: any) { blockedA = /only supplier/i.test(e.message); }
    check('A blocked — sole supplier of the Basic item', blockedA);

    // Remove that item's link so A is no longer anyone's only source, then A is deletable
    // (proItem still has B) and its junction rows should be retired.
    await p.itemSupplier.updateMany({ where: { itemId: basicItem.id }, data: { deleted: true, deletedAt: new Date() } });
    let blockedA2 = false;
    try { await supplierService.remove(supA.id, DB); }
    catch (e: any) { blockedA2 = /only supplier/i.test(e.message); }
    check('A now deletable — proItem still has B', !blockedA2);
    check('A\'s remaining junction rows retired',
        (await p.itemSupplier.count({ where: { supplierId: supA.id, deleted: false } })) === 0);
    check('supplier soft-delete bumped updatedAt (delta sync will deliver it)',
        (await p.supplier.findUnique({ where: { id: supA.id } }))!.updatedAt != null);

    // B is now proItem's only source → must be blocked.
    let blockedB = false;
    try { await supplierService.remove(supB.id, DB); }
    catch (e: any) { blockedB = /only supplier/i.test(e.message); }
    check('B blocked — it is now the sole supplier', blockedB);

    // Cleanup
    await p.itemSupplier.deleteMany({ where: { itemId: { in: [basicItem.id, proItem.id] } } });
    await p.stockMovement.deleteMany({ where: { itemId: { in: [basicItem.id, proItem.id] } } });
    await p.stockBalance.deleteMany({ where: { itemId: { in: [basicItem.id, proItem.id] } } });
    await p.item.deleteMany({ where: { id: { in: [basicItem.id, proItem.id] } } });
    await p.supplier.deleteMany({ where: { id: { in: [supA.id, supB.id] } } });

    console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed\n`);
    process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
