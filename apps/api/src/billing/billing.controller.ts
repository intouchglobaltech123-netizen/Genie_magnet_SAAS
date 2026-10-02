import { Controller, Get, Headers, HttpCode, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Platform, Public } from "../access/access.js";
import { RateLimit } from "../common/rate-limit.js";
import { BillingService } from "./billing.service.js";

/** Where our payment providers tell us about agencies' payments (P6-04), signed with each webhook's secret. */
@ApiTags("billing")
@Controller("webhooks/billing")
export class BillingWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post("razorpay")
  @Public()
  @HttpCode(200)
  @RateLimit({ max: 3000, windowSeconds: 60 })
  razorpay(@Req() req: { rawBody?: Buffer; body: unknown }, @Headers("x-razorpay-signature") signature?: string) {
    return this.billing.razorpay(req.rawBody, signature, req.body as never);
  }

  @Post("stripe")
  @Public()
  @HttpCode(200)
  @RateLimit({ max: 3000, windowSeconds: 60 })
  stripe(@Req() req: { rawBody?: Buffer; body: unknown }, @Headers("stripe-signature") signature?: string) {
    return this.billing.stripe(req.rawBody, signature, req.body as never);
  }
}

/** Our invoices to every agency, for the platform console (P6-04). */
@ApiTags("platform")
@Controller("platform/invoices")
@Platform()
export class PlatformInvoicesController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  list() {
    return this.billing.all();
  }
}
