import express, { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth-request";
import { requirePermission } from "../middleware/require-permission.middleware";
import { sendResponse } from "../api-helpers/network";
import { RequestValidateError } from "../api-helpers/error";
import {
  createImageUploadTicket,
  ImageTargetKind,
} from "./catalogue-storage.service";

const router = express.Router();

// Item-image upload is an inventory-management action → reuse the existing
// "Manage Inventory" permission (no new permission seed needed for v1).
const MANAGE_INVENTORY = "Manage Inventory";

/**
 * POST /catalogue/image-upload-url
 * Body: { kind: 'item' | 'variant', targetId: number, contentType?: 'image/webp' }
 * Returns: { uploadUrl, publicUrl, key, contentType, expiresIn }
 *
 * Auth: global authorizeMiddleware (req.user) + Manage Inventory permission.
 * The client PUTs the image bytes to `uploadUrl`, then persists `publicUrl`
 * on the item/variant via the normal update endpoint.
 */
const requestImageUploadUrl = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw new RequestValidateError("User not authenticated");
  }

  const { kind, targetId, contentType } = req.body ?? {};

  if (kind !== "item" && kind !== "variant") {
    throw new RequestValidateError("kind must be 'item' or 'variant'");
  }

  const id = Number(targetId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new RequestValidateError("targetId must be a positive integer");
  }

  createImageUploadTicket({
    tenantId: req.user.tenantId,
    kind: kind as ImageTargetKind,
    targetId: id,
    contentType:
      typeof contentType === "string" && contentType ? contentType : "image/webp",
  })
    .then((ticket) => sendResponse(res, ticket))
    .catch(next);
};

router.post(
  "/image-upload-url",
  requirePermission(MANAGE_INVENTORY),
  requestImageUploadUrl
);

export = router;
