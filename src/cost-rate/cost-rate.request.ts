import { CostRate } from "../../prisma/client/generated/client"

export interface CreateCostRateRequestBody {
    rates: CostRate[]
}

export interface GenerateForSessionRequestBody {
    sessionId: number
}
