import { ExpenseCategory } from "../../prisma/client/generated/client"

export interface CreateExpenseCategoryRequestBody {
    categories: ExpenseCategory[]
}
