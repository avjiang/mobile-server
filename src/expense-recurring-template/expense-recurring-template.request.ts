import { ExpenseRecurringTemplate } from "../../prisma/client/generated/client"

export interface CreateExpenseRecurringTemplateRequestBody {
    templates: ExpenseRecurringTemplate[]
}

export interface PostMonthRequestBody {
    periodMonth: string // 'YYYY-MM'
}
