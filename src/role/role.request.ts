import { Category } from "prisma/client"

export interface CreateRoleRequestBody {
    id?: number;
    name: string;
    description?: string;
    permissionIds?: number[];
}

export interface AssignRoleRequestBody {
    roleIds: number[];
}