import { z } from "zod";

import { AMOUNT_RE, parseAmount } from "@/features/money/amount";

// Strict shapes for financial data. Invalid data fails loudly; it is never shown as 0.

const amount = z.string().max(80).regex(AMOUNT_RE);
const timestamp = z
  .string()
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid timestamp");
const asset = z.string().min(1).max(20);

export const BalanceItemSchema = z
  .object({
    asset,
    decimals: z.number().int().min(0).max(36),
    available: amount,
    pending: amount,
    claiming: amount,
    usdPrice: amount,
  })
  .refine(
    (b) => [b.available, b.pending, b.claiming].every((v) => parseAmount(v, b.decimals).ok),
    "Amount has more decimals than the asset allows",
  );

export const BalancesSchema = z.object({
  asOf: timestamp,
  items: z.array(BalanceItemSchema).max(100),
});

export const ClaimOptionsSchema = z.object({
  asset,
  minAmount: amount,
  fee: amount,
  destinations: z
    .array(z.object({ id: z.string().min(1).max(100), label: z.string().max(200) }))
    .max(50),
});

export const ClaimStatusSchema = z.enum(["pending", "completed", "failed"]);

export const ClaimSchema = z.object({
  id: z.string().min(1).max(100),
  asset,
  amount,
  fee: amount,
  receiveAmount: amount,
  destinationId: z.string().max(100),
  status: ClaimStatusSchema,
  failureReason: z.string().max(500).nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export type BalanceItem = z.infer<typeof BalanceItemSchema>;
export type Balances = z.infer<typeof BalancesSchema>;
export type ClaimOptions = z.infer<typeof ClaimOptionsSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

const signedAmount = z
  .string()
  .max(81)
  .regex(/^-?(0|[1-9]\d*)(\.\d+)?$/);

export const ActivityItemSchema = z.object({
  id: z.string().min(1).max(100),
  // Shown as plain text; unknown values are displayed as-is rather than rejected.
  type: z.string().max(40),
  asset,
  amount: signedAmount,
  status: z.string().max(40),
  exchange: z.string().max(100).nullable(),
  createdAt: timestamp,
  relatedId: z.string().max(100).nullable(),
});

export const ActivityPageSchema = z.object({
  items: z.array(ActivityItemSchema).max(20),
  nextCursor: z.string().max(500).nullable(),
});

export type ActivityItem = z.infer<typeof ActivityItemSchema>;
export type ActivityPage = z.infer<typeof ActivityPageSchema>;
