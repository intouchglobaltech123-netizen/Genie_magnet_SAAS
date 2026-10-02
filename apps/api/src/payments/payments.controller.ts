import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Put, Req } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { paymentConnectionInput } from "@gm/shared";
import { Can, Public } from "../access/access.js";
import { RateLimit } from "../common/rate-limit.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { PaymentsService } from "./payments.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** Settings → Payments (P3-10): the agency's own Razorpay keys, and the webhook to paste into Razorpay. */
@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @Can("settings", "view")
  settings() {
    return this.payments.settings();
  }

  @Put("connection")
  @Can("settings", "edit")
  @ApiBody({ schema: schema(paymentConnectionInput) })
  connect(@Body(new ZodPipe(paymentConnectionInput)) b: z.output<typeof paymentConnectionInput>) {
    return this.payments.connect(b);
  }

  @Post("connection/check")
  @Can("settings", "edit")
  @HttpCode(200)
  check() {
    return this.payments.check();
  }

  @Delete("connection")
  @Can("settings", "edit")
  disconnect() {
    return this.payments.disconnect();
  }
}

/** A payment link for an issued invoice, made again on request. */
@ApiTags("payments")
@Controller("invoices/:id/pay-link")
export class InvoicePayLinkController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @Can("invoices", "edit")
  @HttpCode(200)
  request(@Param("id", ParseUUIDPipe) id: string) {
    return this.payments.requestLink(id);
  }
}

/** The address each agency gives Razorpay: payment links paid, cancelled or expired, signed with its webhook secret. */
@ApiTags("payments")
@Controller("webhooks/razorpay/:connectionId")
export class RazorpayWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @Public()
  @HttpCode(200)
  @RateLimit({ max: 3000, windowSeconds: 60 })
  receive(@Param("connectionId") connectionId: string, @Req() req: { rawBody?: Buffer; body: unknown }, @Headers("x-razorpay-signature") signature?: string) {
    return this.payments.receive(connectionId, req.rawBody, signature, req.body as never);
  }
}
