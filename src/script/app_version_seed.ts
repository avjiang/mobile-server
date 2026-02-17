
import { PrismaClient } from '../../prisma/global-client/generated/global';

const prisma = new PrismaClient();

async function seed() {
    console.log('Seeding AppVersion...');

    const versions = [
        {
            platform: 'android',
            minVersion: '1.0.0',
            latestVersion: '1.0.0',
            title: 'Update Available',
            message: 'A new version of the app is available. Please update to continue using the app.',
            storeUrl: 'https://play.google.com/store/apps/details?id=com.example.app'
        },
        {
            platform: 'ios',
            minVersion: '1.0.0',
            latestVersion: '1.0.0',
            title: 'Update Available',
            message: 'A new version of the app is available. Please update to continue using the app.',
            storeUrl: 'https://apps.apple.com/app/id123456789'
        }
    ];

    for (const version of versions) {
        const existing = await prisma.appVersion.findFirst({
            where: { platform: version.platform }
        });

        if (!existing) {
            await prisma.appVersion.create({
                data: version
            });
            console.log(`Created AppVersion for ${version.platform}`);
        } else {
            console.log(`AppVersion for ${version.platform} already exists`);
        }
    }

    console.log('Seeding AppVersion completed.');
}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
