import { Category } from "@prisma/tenant-prisma"

export interface CreateRoleRequestBody {
    id?: number;
    name: string;
    description?: string;
    permissionIds?: number[];
}

export interface AssignRoleRequestBody {
    roleIds: number[];
}