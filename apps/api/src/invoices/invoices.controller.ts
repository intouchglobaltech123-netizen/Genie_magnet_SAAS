import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  agreementInvoiceInput,
  invoiceCancel,
  invoiceInput,
  invoiceIssue,
  invoicePayment,
  type InvoicePayment,
  invoiceSettingsInput,
  invoiceUpdate,
  INVOICE_STATUSES,
} from "@gm/shared";
import { Can } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { InvoicesService } from "./invoices.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

@ApiTags("invoices")
@Controller("invoice-settings")
export class InvoiceSettingsController {
  constructor(private readonly invoices: InvoicesService) {}

  /** Null until the agency sets them up. */
  @Get()
  @Can("invoices", "view")
  get() {
    return this.invoices.settings();
  }

  /** Also needs edit on agency settings, or approve on invoices (finance). */
  @Put()
  @Can("invoices", "edit")
  @ApiBody({ schema: schema(invoiceSettingsInput) })
  save(@Body(new ZodPipe(invoiceSettingsInput)) body: z.output<typeof invoiceSettingsInput>) {
    return this.invoices.saveSettings(body);
  }
}

@ApiTags("invoices")
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  /** e.g. `?status=draft`, `?overdue=1` (sent, unpaid and past due), `?clientId=…`. */
  @Get()
  @Can("invoices", "view")
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "clientId", required: false })
  @ApiQuery({ name: "overdue", required: false })
  list(@Query("status") status?: string, @Query("clientId") clientId?: string, @Query("overdue") overdue?: string) {
    return this.invoices.list({
      status: INVOICE_STATUSES.find((s) => s === status),
      clientId: clientId && z.uuid().safeParse(clientId).success ? clientId : undefined,
      overdue: overdue === "1",
    });
  }

  @Get(":id")
  @Can("invoices", "view")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.invoices.get(id);
  }

  /** A draft with any lines. */
  @Post()
  @Can("invoices", "edit")
  @ApiBody({ schema: schema(invoiceInput) })
  create(@Body(new ZodPipe(invoiceInput)) body: z.output<typeof invoiceInput>) {
    return this.invoices.create(body);
  }

  @Patch(":id")
  @Can("invoices", "edit")
  @ApiBody({ schema: schema(invoiceUpdate) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(invoiceUpdate)) body: z.output<typeof invoiceUpdate>) {
    return this.invoices.update(id, body);
  }

  /** Numbers the invoice and fixes its details: it can then be sent to the client. */
  @Post(":id/issue")
  @Can("invoices", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(invoiceIssue) })
  issue(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(invoiceIssue)) body: { issueDate?: string }) {
    return this.invoices.issue(id, body.issueDate);
  }

  @Post(":id/paid")
  @Can("invoices", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(invoicePayment) })
  paid(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(invoicePayment)) body: InvoicePayment) {
    return this.invoices.markPaid(id, body);
  }

  @Post(":id/cancel")
  @Can("invoices", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(invoiceCancel) })
  cancel(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(invoiceCancel)) body: { reason: string }) {
    return this.invoices.cancel(id, body.reason);
  }

  /** Only drafts. */
  @Delete(":id")
  @Can("invoices", "edit")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.invoices.remove(id);
  }
}

/** A draft invoice for one month of an agreement. */
@ApiTags("invoices")
@Controller("agreements")
export class AgreementInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post(":id/invoices")
  @Can("invoices", "edit")
  @ApiBody({ schema: schema(agreementInvoiceInput) })
  fromAgreement(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(agreementInvoiceInput)) body: { period: string }) {
    return this.invoices.fromAgreement(id, body.period);
  }
}
