
import { getGlobalPrisma } from '../db';

const getVersion = async (platform: string) => {
    const prisma = getGlobalPrisma();
    const version = await prisma.appVersion.findFirst({
        where: { platform }
    });
    return version;
}

const getVersions = async () => {
    const prisma = getGlobalPrisma();
    const versions = await prisma.appVersion.findMany();
    return versions;
}

const updateVersion = async (platform: string, data: any) => {
    const prisma = getGlobalPrisma();
    const version = await prisma.appVersion.upsert({
        where: { platform },
        update: {
            minVersion: data.minVersion,
            latestVersion: data.latestVersion,
            storeUrl: data.storeUrl
        },
        create: {
            platform,
            minVersion: data.minVersion,
            latestVersion: data.latestVersion,
            storeUrl: data.storeUrl
        }
    });
    return version;
}

export default {
    getVersion,
    getVersions,
    updateVersion
}
