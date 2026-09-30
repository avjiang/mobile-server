import { PERMISSION } from '../permission/permission-names';

/**
 * Who may remove (deactivate) a push device: its own user always — staff clear
 * their old phone from "My devices" — and anyone else's only with
 * "Manage Push Notification Devices" (the owner's device list). [granted] is
 * the caller's effective permission list ('*' = super admin).
 */
export const canRemoveDevice = (
    deviceTenantUserId: number,
    callerTenantUserId: number,
    granted: string[],
): boolean =>
    deviceTenantUserId === callerTenantUserId ||
    granted.includes('*') ||
    granted.includes(PERMISSION.MANAGE_PUSH_DEVICES);
