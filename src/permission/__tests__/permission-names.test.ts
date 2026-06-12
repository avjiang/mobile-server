// Guards against drift between the PERMISSION constants (used by
// requirePermission(...) in controllers) and the actual seeded permission
// names. If someone renames a seed entry or mistypes a constant, this fails.
//
// Run with:  npm test

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { PERMISSION } from "../permission-names";
import { permissions as seed } from "../../script/permission_seed";

describe("PERMISSION constants ↔ permission seed", () => {
    const seedNames = new Set(seed.map((p) => p.name));

    test("every PERMISSION constant exists as a seeded permission name", () => {
        const orphans = Object.entries(PERMISSION)
            .filter(([, value]) => !seedNames.has(value))
            .map(([key, value]) => `${key} -> "${value}"`);

        assert.deepEqual(
            orphans,
            [],
            `These PERMISSION constants have no matching seed name and can ` +
                `never be satisfied by any role: ${orphans.join(", ")}`
        );
    });

    test("every seeded permission name has a PERMISSION constant", () => {
        const values = new Set<string>(Object.values(PERMISSION));
        const missing = [...seedNames].filter((name) => !values.has(name));

        assert.deepEqual(
            missing,
            [],
            `These seeded permissions are missing from PERMISSION constants: ` +
                `${missing.join(", ")}`
        );
    });
});
