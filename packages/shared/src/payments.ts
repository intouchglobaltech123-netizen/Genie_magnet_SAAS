// Payments (P3-10): each agency's own Razorpay account and the payment links on its invoices.
import { z } from "zod";

/** The keys from the Razorpay Dashboard → Account & Settings → API keys. The secret may be left empty to keep it. */
export const paymentConnectionInput = z.object({
  keyId: z
    .string()
    .trim()
    .regex(/^rzp_(test|live)_[A-Za-z0-9]{6,}$/, "The key ID starts with rzp_live_ (or rzp_test_ for trying it out)"),
  keySecret: z
    .string()
    .trim()
    .min(10, "Paste the key secret")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type PaymentConnectionInput = z.input<typeof paymentConnectionInput>;
