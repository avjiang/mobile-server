import { User } from "prisma/client"

export interface AssignRoleRequestBody {
    id?: number;
    name: string;
    description?: string;
    permissionIds?: number[];
}

export interface AssignRoleRequestBody {
    roleIds: number[];
}

export interface UpdateUserRequestBody {
    id?: number;
    username?: string;
    lastName?: string;
    firstName?: string;
    mobile?: string;
    email?: string;
    roles?: { id: number }[];
}