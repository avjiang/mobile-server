import express, { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth-request";
import { requirePermission } from "../middleware/require-permission.middleware";
import { requirePlan } from "../middleware/require-plan.middleware";
import { sendResponse } from "../api-helpers/network";
import { RequestValidateError } from "../api-helpers/error";
import {
  createImageUploadTicket,
  ImageTargetKind,
} from "./catalogue-storage.service";
import {
  getCatalogueConfig,
  updateCatalogueConfig,
} from "./catalogue-config.service";

const router = express.Router();

// Item-image upload is an inventory-management action → reuse the existing
// "Manage Inventory" permission (no new permission seed needed for v1).
const MANAGE_INVENTORY = "Manage Inventory";
// Online catalogue is a Pro-tier feature (see docs/modules/SUBSCRIPTION.md).
const PRO_PLAN = "Pro";

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
  requirePlan(PRO_PLAN),
  requirePermission(MANAGE_INVENTORY),
  requestImageUploadUrl
);

/**
 * GET /catalogue/settings → { slug, whatsappNumber, catalogueEnabled }
 * The tenant's public-catalogue config (stored on the global Tenant row).
 */
const getSettings = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new RequestValidateError("User not authenticated");
  }
  getCatalogueConfig(req.user.tenantId)
    .then((config) => sendResponse(res, config))
    .catch(next);
};

/**
 * PUT /catalogue/settings
 * Body: { slug?: string, whatsappNumber?: string|null, catalogueEnabled?: boolean }
 * Validates + slugifies + enforces global slug uniqueness, then updates the
 * tenant's catalogue config. Returns the saved config.
 */
const updateSettings = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new RequestValidateError("User not authenticated");
  }
  const { slug, whatsappNumber, catalogueEnabled } = req.body ?? {};
  updateCatalogueConfig(req.user.tenantId, {
    slug,
    whatsappNumber,
    catalogueEnabled,
  })
    .then((config) => sendResponse(res, config))
    .catch(next);
};

router.get("/settings", requirePlan(PRO_PLAN), requirePermission(MANAGE_INVENTORY), getSettings);
router.put("/settings", requirePlan(PRO_PLAN), requirePermission(MANAGE_INVENTORY), updateSettings);

export = router;
