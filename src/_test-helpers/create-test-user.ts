import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async () => {
    //create test user if the db is empty
    const userCount = await prisma.user.count()
    if (userCount == 0) {
        const user = await prisma.user.create({
            data: {
                username: 'test',
                password: bcrypt.hashSync('test', 10),
                firstName: 'Test',
                lastName: 'User',
                role: 'tester'
            }
        })
    }
}