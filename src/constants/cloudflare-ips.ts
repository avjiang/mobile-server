/**
 * Cloudflare edge IP ranges — used as Express `trust proxy` so `req.ip` is only
 * derived from forwarded headers (X-Forwarded-For / CF-Connecting-IP) when the
 * request's actual TCP peer is a Cloudflare edge. A client hitting the Azure
 * origin directly cannot spoof its source IP, so the public rate limiter can no
 * longer be bypassed by forging CF-Connecting-IP. (Security review H-1, 2026-06-19.)
 *
 * Source of truth: https://api.cloudflare.com/client/v4/ips  (etag captured below).
 * These change very rarely — refresh if Cloudflare publishes new ranges.
 *   etag as of 2026-06-19: 38f79d050aa027e3be3865e495dcc9bc
 */
export const CLOUDFLARE_IP_RANGES: string[] = [
  // IPv4
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  // IPv6
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];
