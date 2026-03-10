#!/bin/bash
# Regenerate Prisma clients on the EB instance to download ARM-native engine binaries.
# The CI runner is x86, so the engine binaries in node_modules are for the wrong architecture.
cd /var/app/current
npx prisma generate --schema=prisma/client/schema.prisma
npx prisma generate --schema=prisma/global-client/schema.prisma
