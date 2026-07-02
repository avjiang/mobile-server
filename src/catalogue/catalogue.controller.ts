import express, { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth-request";
import { requirePermission } from "../middleware/require-permission.middleware";
import { requirePlan } from "../middleware/require-plan.middleware";
import { sendResponse } from "../api-helpers/network";
import { RequestValidateError } from "../api-helpers/error";
import {
  createImageUploadTicket,
  createBrandingUploadTicket,
  ImageTargetKind,
  BrandingKind,
} from "./catalogue-storage.service";
import {
  getCatalogueConfig,
  updateCatalogueConfig,
} from "./catalogue-config.service";
import {
  getCatalogueStorageReport,
  deleteCatalogueAsset,
} from "./catalogue-assets.service";

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

  const { kind, targetId, contentType, contentLength } = req.body ?? {};

  if (kind !== "item" && kind !== "variant") {
    throw new RequestValidateError("kind must be 'item' or 'variant'");
  }

  const id = Number(targetId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new RequestValidateError("targetId must be a positive integer");
  }

  const size = Number(contentLength);

  createImageUploadTicket({
    tenantId: req.user.tenantId,
    kind: kind as ImageTargetKind,
    targetId: id,
    contentType:
      typeof contentType === "string" && contentType ? contentType : "image/webp",
    contentLength: Number.isFinite(size) && size > 0 ? size : undefined,
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
 * POST /catalogue/branding-upload-url
 * Body: { kind: 'logo' | 'cover', contentType?: 'image/webp', contentLength?: number }
 * Returns: { uploadUrl, publicUrl, key, contentType, expiresIn }
 *
 * Same flow as item images but for the storefront logo/cover. The client PUTs
 * the bytes then persists `publicUrl` via PUT /catalogue/settings (logoUrl/coverUrl).
 */
const requestBrandingUploadUrl = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw new RequestValidateError("User not authenticated");
  }
  const { kind, contentType, contentLength } = req.body ?? {};
  if (kind !== "logo" && kind !== "cover") {
    throw new RequestValidateError("kind must be 'logo' or 'cover'");
  }
  const size = Number(contentLength);
  createBrandingUploadTicket({
    tenantId: req.user.tenantId,
    kind: kind as BrandingKind,
    contentType:
      typeof contentType === "string" && contentType ? contentType : "image/webp",
    contentLength: Number.isFinite(size) && size > 0 ? size : undefined,
  })
    .then((ticket) => sendResponse(res, ticket))
    .catch(next);
};

router.post(
  "/branding-upload-url",
  requirePlan(PRO_PLAN),
  requirePermission(MANAGE_INVENTORY),
  requestBrandingUploadUrl
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
  const { slug, whatsappNumber, catalogueEnabled, logoUrl, coverUrl, priceVisible } =
    req.body ?? {};
  updateCatalogueConfig(req.user.tenantId, {
    slug,
    whatsappNumber,
    catalogueEnabled,
    logoUrl,
    coverUrl,
    priceVisible,
  })
    .then((config) => sendResponse(res, config))
    .catch(next);
};

router.get("/settings", requirePlan(PRO_PLAN), requirePermission(MANAGE_INVENTORY), getSettings);
router.put("/settings", requirePlan(PRO_PLAN), requirePermission(MANAGE_INVENTORY), updateSettings);

/**
 * GET /catalogue/storage
 * Returns the storage report for the merchant "Catalogue Storage" screen:
 * every stored photo (mapped to its product name, orphans flagged), the
 * used/limit totals, and the orphan count/bytes. Sorted largest-first.
 */
const getStorage = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new RequestValidateError("User not authenticated");
  }
  getCatalogueStorageReport(req.user.tenantId, req.user.databaseName)
    .then((report) => sendResponse(res, report))
    .catch(next);
};

/**
 * POST /catalogue/image/delete
 * Body: { key: string } OR { kind: 'item'|'variant', targetId: number }
 * Deletes the R2 object and clears the owning item/variant photo pointer.
 * Returns the post-delete { storageUsedBytes, storageLimitBytes }.
 */
const deleteImage = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new RequestValidateError("User not authenticated");
  }
  const { key, kind, targetId } = req.body ?? {};
  const id = Number(targetId);
  deleteCatalogueAsset(req.user.tenantId, req.user.databaseName, {
    key: typeof key === "string" && key ? key : undefined,
    kind: kind === "item" || kind === "variant" ? kind : undefined,
    targetId: Number.isInteger(id) && id > 0 ? id : undefined,
  })
    .then((usage) => sendResponse(res, usage))
    .catch(next);
};

router.get("/storage", requirePlan(PRO_PLAN), requirePermission(MANAGE_INVENTORY), getStorage);
router.post("/image/delete", requirePlan(PRO_PLAN), requirePermission(MANAGE_INVENTORY), deleteImage);

export = router;
