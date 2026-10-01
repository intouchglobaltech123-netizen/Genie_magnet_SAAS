import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  activityInput,
  type ActivityInput,
  leadInput,
  leadUpdate,
  type LeadUpdate,
  pipelineInput,
  type PipelineInput,
  proposalAnswer,
  type ProposalAnswer,
  proposalApproval,
  proposalInput,
  proposalRejection,
  winInput,
  type WinInput,
} from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { LeadsService } from "./leads.service.js";
import { PipelineService } from "./pipeline.service.js";
import { ProposalsService } from "./proposals.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** Settings → Pipeline: the agency's sales stages. */
@ApiTags("crm")
@Controller("pipeline")
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  @Get("stages")
  @Staff()
  stages() {
    return this.pipeline.stages();
  }

  /** The open stages in order (keep a stage's key to rename it). Won and Lost are fixed. */
  @Put("stages")
  @Can("settings", "edit")
  @ApiBody({ schema: schema(pipelineInput) })
  update(@Body(new ZodPipe(pipelineInput)) body: PipelineInput) {
    return this.pipeline.update(body);
  }
}

/** Leads and the people following them up. */
@ApiTags("crm")
@Controller("leads")
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly proposals: ProposalsService,
  ) {}

  @Get()
  @Can("crm", "view")
  @ApiQuery({ name: "stage", required: false })
  @ApiQuery({ name: "owner", required: false, description: "A team member's id" })
  @ApiQuery({ name: "q", required: false, description: "Search name, company, phone, email" })
  @ApiQuery({ name: "due", required: false, description: "1: follow-ups due today or overdue" })
  list(@Query("stage") stage?: string, @Query("owner") ownerId?: string, @Query("q") q?: string, @Query("due") due?: string) {
    return this.leads.list({ stage, ownerId, q: q?.trim().slice(0, 100) || undefined, due: due === "1" || due === "true" });
  }

  @Post()
  @Can("crm", "edit")
  @ApiBody({ schema: schema(leadInput) })
  create(@Body(new ZodPipe(leadInput)) body: z.output<typeof leadInput>) {
    return this.leads.create(body);
  }

  /** The lead with its calls, meetings and notes, newest first. */
  @Get(":id")
  @Can("crm", "view")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.leads.get(id);
  }

  /** Any field, including moving it to another stage. */
  @Patch(":id")
  @Can("crm", "edit")
  @ApiBody({ schema: schema(leadUpdate) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(leadUpdate)) body: LeadUpdate) {
    return this.leads.update(id, body);
  }

  @Delete(":id")
  @Can("crm", "edit")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.leads.remove(id);
  }

  /** A proposal from one of the agency's packages; a discount above the agency's limit waits for approval. */
  @Post(":id/proposals")
  @Can("crm", "edit")
  @ApiBody({ schema: schema(proposalInput) })
  propose(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(proposalInput)) body: z.output<typeof proposalInput>) {
    return this.proposals.create(id, body);
  }

  /** The deal is won: client, contact and agreement are set up together. Also needs edit on clients. */
  @Post(":id/win")
  @Can("crm", "edit")
  @ApiBody({ schema: schema(winInput) })
  win(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(winInput)) body: WinInput) {
    return this.proposals.win(id, body);
  }

  @Post(":id/activities")
  @Can("crm", "edit")
  @ApiBody({ schema: schema(activityInput) })
  addActivity(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(activityInput)) body: ActivityInput) {
    return this.leads.addActivity(id, body);
  }
}

/** Proposals and their approval. */
@ApiTags("crm")
@Controller("proposals")
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  /** e.g. `?status=pending_approval` for the approvals list. */
  @Get()
  @Can("crm", "view")
  @ApiQuery({ name: "status", required: false })
  list(@Query("status") status?: string) {
    return this.proposals.list(status);
  }

  @Post(":id/approve")
  @Can("crm", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(proposalApproval) })
  approve(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(proposalApproval)) body: { note?: string }) {
    return this.proposals.decide(id, true, body.note);
  }

  @Post(":id/reject")
  @Can("crm", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(proposalRejection) })
  reject(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(proposalRejection)) body: { note: string }) {
    return this.proposals.decide(id, false, body.note);
  }

  @Post(":id/sent")
  @Can("crm", "edit")
  @HttpCode(200)
  sent(@Param("id", ParseUUIDPipe) id: string) {
    return this.proposals.markSent(id);
  }

  /** The client's answer: accepted or declined. */
  @Post(":id/answer")
  @Can("crm", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(proposalAnswer) })
  answer(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(proposalAnswer)) body: ProposalAnswer) {
    return this.proposals.answer(id, body);
  }
}
