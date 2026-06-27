import { Expense } from "../../prisma/client/generated/client"

export interface CreateExpenseRequestBody {
    expenses: Expense[]
}
