import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  changeRequestInput,
  changeRequestStep,
  clientDecision,
  type ClientDecision,
  commentInput,
  connectionInput,
  contentInput,
  contentUpdate,
  type ContentUpdate,
  cycleClose,
  cyclesGenerate,
  editStepInput,
  incidentInput,
  kitTickInput,
  moveInput,
  pillarsInput,
  postInput,
  preShootTick,
  productionSettingsInput,
  publishedInput,
  qcInput,
  scriptInput,
  shootInput,
  shootSign,
  shootUpdate,
  timeLogInput,
  topicListInput,
  versionInput,
  videoInput,
  videoUpdate,
  type VideoUpdate,
} from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CalendarService } from "./calendar.service.js";
import { ContentService } from "./content.service.js";
import { CyclesService } from "./cycles.service.js";
import { ProductionSettingsService } from "./production-settings.service.js";
import { PublishingService } from "./publishing.service.js";
import { ShootsService } from "./shoots.service.js";
import { VideosService } from "./videos.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const body = <T extends z.ZodType>(s: T) => new ZodPipe(s);
const monthPipe = new ZodPipe(
  z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
);
const uuidOrNone = (v?: string) => (v && z.uuid().safeParse(v).success ? v : undefined);

@ApiTags("production")
@Controller("production-settings")
export class ProductionSettingsController {
  constructor(private readonly settings: ProductionSettingsService) {}

  @Get()
  @Staff()
  get() {
    return this.settings.get();
  }

  /** Also needs edit on agency settings, or approve on production. */
  @Put()
  @Staff()
  @ApiBody({ schema: schema(productionSettingsInput) })
  save(@Body(body(productionSettingsInput)) b: z.output<typeof productionSettingsInput>) {
    return this.settings.save(b);
  }
}

@ApiTags("production")
@Controller("cycles")
export class CyclesController {
  constructor(private readonly cycles: CyclesService) {}

  @Get()
  @Can("production", "view")
  @ApiQuery({ name: "month", required: false })
  list(@Query("month", monthPipe) month?: string) {
    return this.cycles.list(month);
  }

  /** Makes the month's cycles for every running agreement (ahead of the month). */
  @Post("generate")
  @Can("production", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(cyclesGenerate) })
  generate(@Body(body(cyclesGenerate)) b: { month: string }) {
    return this.cycles.generate(b.month);
  }

  /** Closing a month decides what happens to a shortfall: a commercial decision. */
  @Post(":id/close")
  @Can("agreements", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(cycleClose) })
  close(@Param("id", ParseUUIDPipe) id: string, @Body(body(cycleClose)) b: z.output<typeof cycleClose>) {
    return this.cycles.close(id, b);
  }
}

@ApiTags("content")
@Controller("content")
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  @Can("content", "view")
  @ApiQuery({ name: "clientId", required: false })
  @ApiQuery({ name: "month", required: false })
  @ApiQuery({ name: "stage", required: false })
  list(@Query("clientId") clientId?: string, @Query("month", monthPipe) month?: string, @Query("stage") stage?: string) {
    return this.content.list({
      clientId: uuidOrNone(clientId),
      month,
      stage: ["idea", "topic", "research", "script", "approval", "ready"].find((s) => s === stage),
    });
  }

  @Get(":id")
  @Can("content", "view")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.content.get(id);
  }

  @Post()
  @Can("content", "edit")
  @ApiBody({ schema: schema(contentInput) })
  create(@Body(body(contentInput)) b: z.output<typeof contentInput>) {
    return this.content.create(b);
  }

  @Patch(":id")
  @Can("content", "edit")
  @ApiBody({ schema: schema(contentUpdate) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(body(contentUpdate)) b: ContentUpdate) {
    return this.content.update(id, b);
  }

  @Delete(":id")
  @Can("content", "edit")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.content.remove(id);
  }

  @Post(":id/start")
  @Can("content", "edit")
  @HttpCode(200)
  start(@Param("id", ParseUUIDPipe) id: string) {
    return this.content.start(id);
  }

  @Post(":id/research-done")
  @Can("content", "edit")
  @HttpCode(200)
  researchDone(@Param("id", ParseUUIDPipe) id: string) {
    return this.content.researchDone(id);
  }

  /** Saves the script draft (a new version once the last one was sent). */
  @Put(":id/script")
  @Can("content", "edit")
  @ApiBody({ schema: schema(scriptInput) })
  script(@Param("id", ParseUUIDPipe) id: string, @Body(body(scriptInput)) b: z.output<typeof scriptInput>) {
    return this.content.saveScript(id, b);
  }

  @Post(":id/script/review")
  @Can("content", "edit")
  @HttpCode(200)
  review(@Param("id", ParseUUIDPipe) id: string) {
    return this.content.askReview(id);
  }

  /** The reviewer sends it to the client. */
  @Post(":id/script/send")
  @Can("content", "approve")
  @HttpCode(200)
  send(@Param("id", ParseUUIDPipe) id: string) {
    return this.content.send(id);
  }

  /** The client's answer; approved scripts become videos. */
  @Post(":id/script/decision")
  @Can("content", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(clientDecision) })
  decision(@Param("id", ParseUUIDPipe) id: string, @Body(body(clientDecision)) b: ClientDecision) {
    return this.content.decide(id, b);
  }

  @Put(":id/pick")
  @Can("content", "edit")
  pick(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(body(z.object({ pick: z.enum(["picked", "skipped"]).nullable() }))) b: { pick: "picked" | "skipped" | null },
  ) {
    return this.content.pick(id, b.pick);
  }
}

@ApiTags("content")
@Controller("topic-lists")
export class TopicListsController {
  constructor(private readonly content: ContentService) {}

  @Get()
  @Can("content", "view")
  @ApiQuery({ name: "month", required: false })
  list(@Query("month", monthPipe) month?: string) {
    return this.content.topicLists(month);
  }

  @Put()
  @Can("content", "edit")
  @ApiBody({ schema: schema(topicListInput) })
  save(@Body(body(topicListInput)) b: z.output<typeof topicListInput>) {
    return this.content.saveTopicList(b);
  }

  @Post(":id/send")
  @Can("content", "edit")
  @HttpCode(200)
  send(@Param("id", ParseUUIDPipe) id: string) {
    return this.content.sendTopicList(id);
  }

  @Post(":id/confirm")
  @Can("content", "edit")
  @HttpCode(200)
  confirm(@Param("id", ParseUUIDPipe) id: string) {
    return this.content.confirmTopicList(id);
  }
}

@ApiTags("content")
@Controller("clients")
export class ClientContentController {
  constructor(
    private readonly content: ContentService,
    private readonly publishing: PublishingService,
  ) {}

  @Put(":id/pillars")
  @Can("content", "edit")
  @ApiBody({ schema: schema(pillarsInput) })
  pillars(@Param("id", ParseUUIDPipe) id: string, @Body(body(pillarsInput)) b: { pillars: string[] }) {
    return this.content.setPillars(id, b.pillars);
  }

  @Get(":id/platforms")
  @Can("publishing", "view")
  platforms(@Param("id", ParseUUIDPipe) id: string) {
    return this.publishing.connections(id);
  }

  @Post(":id/platforms")
  @Can("publishing", "edit")
  @ApiBody({ schema: schema(connectionInput) })
  addPlatform(@Param("id", ParseUUIDPipe) id: string, @Body(body(connectionInput)) b: z.output<typeof connectionInput>) {
    return this.publishing.addConnection(id, b);
  }

  @Delete(":id/platforms/:platformId")
  @Can("publishing", "edit")
  removePlatform(@Param("id", ParseUUIDPipe) id: string, @Param("platformId", ParseUUIDPipe) platformId: string) {
    return this.publishing.removeConnection(id, platformId);
  }
}

@ApiTags("production")
@Controller("videos")
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  /** e.g. `?stage=editing`, `?due=overdue` or `week`, `?q=KVR`. Roles limited to their own videos see theirs. */
  @Get()
  @Can("production", "view")
  @ApiQuery({ name: "clientId", required: false })
  @ApiQuery({ name: "stage", required: false })
  @ApiQuery({ name: "editorId", required: false })
  @ApiQuery({ name: "shootId", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "due", required: false })
  list(
    @Query("clientId") clientId?: string,
    @Query("stage") stage?: string,
    @Query("editorId") editorId?: string,
    @Query("shootId") shootId?: string,
    @Query("q") q?: string,
    @Query("due") due?: string,
  ) {
    return this.videos.list({ clientId: uuidOrNone(clientId), stage, editorId: editorId?.slice(0, 64), shootId: uuidOrNone(shootId), q: q?.slice(0, 80), due });
  }

  @Get(":id")
  @Can("production", "view")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.videos.get(id);
  }

  @Post()
  @Can("production", "edit")
  @ApiBody({ schema: schema(videoInput) })
  create(@Body(body(videoInput)) b: z.output<typeof videoInput>) {
    return this.videos.create(b);
  }

  @Patch(":id")
  @Can("production", "edit")
  @ApiBody({ schema: schema(videoUpdate) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(body(videoUpdate)) b: VideoUpdate) {
    return this.videos.update(id, b);
  }

  /** Moves the video when its checks allow it. */
  @Post(":id/move")
  @Can("production", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(moveInput) })
  move(@Param("id", ParseUUIDPipe) id: string, @Body(body(moveInput)) b: z.output<typeof moveInput>) {
    return this.videos.move(id, b.to, b.note);
  }

  @Put(":id/edit-steps")
  @Can("production", "edit")
  @ApiBody({ schema: schema(editStepInput) })
  editStep(@Param("id", ParseUUIDPipe) id: string, @Body(body(editStepInput)) b: { step: string; done: boolean }) {
    return this.videos.editStep(id, b.step, b.done);
  }

  /** Footage backed up and verified (VP). */
  @Put(":id/protect")
  @Can("production", "edit")
  protect(@Param("id", ParseUUIDPipe) id: string, @Body(body(z.object({ done: z.boolean() }))) b: { done: boolean }) {
    return this.videos.protect(id, b.done);
  }

  /** A quality check result: approve on production. */
  @Put(":id/qc")
  @Can("production", "approve")
  @ApiBody({ schema: schema(qcInput) })
  qc(@Param("id", ParseUUIDPipe) id: string, @Body(body(qcInput)) b: z.output<typeof qcInput>) {
    return this.videos.qc(id, b.check, b.result, b.note);
  }

  @Post(":id/time")
  @Can("production", "edit")
  @ApiBody({ schema: schema(timeLogInput) })
  time(@Param("id", ParseUUIDPipe) id: string, @Body(body(timeLogInput)) b: z.output<typeof timeLogInput>) {
    return this.videos.logTime(id, b);
  }

  @Delete(":id/time/:logId")
  @Can("production", "edit")
  removeTime(@Param("id", ParseUUIDPipe) id: string, @Param("logId", ParseUUIDPipe) logId: string) {
    return this.videos.removeTime(id, logId);
  }

  @Post(":id/versions")
  @Can("production", "edit")
  @ApiBody({ schema: schema(versionInput) })
  version(@Param("id", ParseUUIDPipe) id: string, @Body(body(versionInput)) b: z.output<typeof versionInput>) {
    return this.videos.addVersion(id, b);
  }

  /** Sends the latest version to the client (after the quality check). */
  @Post(":id/versions/send")
  @Can("production", "edit")
  @HttpCode(200)
  sendVersion(@Param("id", ParseUUIDPipe) id: string) {
    return this.videos.sendVersion(id);
  }

  /** The client's answer on the version they have. */
  @Post(":id/decision")
  @Can("production", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(clientDecision) })
  decision(@Param("id", ParseUUIDPipe) id: string, @Body(body(clientDecision)) b: ClientDecision) {
    return this.videos.decide(id, b);
  }

  @Post(":id/versions/:versionId/comments")
  @Can("production", "edit")
  @ApiBody({ schema: schema(commentInput) })
  comment(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body(body(commentInput)) b: z.output<typeof commentInput>,
  ) {
    return this.videos.comment(id, versionId, b);
  }

  @Put(":id/comments/:commentId")
  @Can("production", "edit")
  resolve(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("commentId", ParseUUIDPipe) commentId: string,
    @Body(body(z.object({ resolved: z.boolean() }))) b: { resolved: boolean },
  ) {
    return this.videos.resolveComment(id, commentId, b.resolved);
  }
}

@ApiTags("production")
@Controller("change-requests")
export class ChangeRequestsController {
  constructor(private readonly videos: VideosService) {}

  @Get()
  @Can("production", "view")
  @ApiQuery({ name: "status", required: false })
  list(@Query("status") status?: string) {
    return this.videos.requests(["open", "awaiting_client", "approved", "rejected", "done"].find((s) => s === status));
  }

  /** Feedback classified: our correction, an included revision, or a change request. */
  @Post()
  @Can("production", "edit")
  @ApiBody({ schema: schema(changeRequestInput) })
  create(@Body(body(changeRequestInput)) b: z.output<typeof changeRequestInput>) {
    return this.videos.request(b);
  }

  @Post(":id/status")
  @Can("production", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(changeRequestStep) })
  step(@Param("id", ParseUUIDPipe) id: string, @Body(body(changeRequestStep)) b: z.output<typeof changeRequestStep>) {
    return this.videos.requestStep(id, b.status);
  }
}

@ApiTags("production")
@Controller("shoots")
export class ShootsController {
  constructor(private readonly shoots: ShootsService) {}

  @Get()
  @Can("production", "view")
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "clientId", required: false })
  list(@Query("from") from?: string, @Query("clientId") clientId?: string) {
    return this.shoots.list({ from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined, clientId: uuidOrNone(clientId) });
  }

  @Get(":id")
  @Can("production", "view")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.shoots.get(id);
  }

  @Post()
  @Can("production", "edit")
  @ApiBody({ schema: schema(shootInput) })
  create(@Body(body(shootInput)) b: z.output<typeof shootInput>) {
    return this.shoots.create(b);
  }

  @Patch(":id")
  @Can("production", "edit")
  @ApiBody({ schema: schema(shootUpdate) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(body(shootUpdate)) b: z.output<typeof shootUpdate>) {
    return this.shoots.update(id, b);
  }

  @Put(":id/kit")
  @Can("production", "edit")
  @ApiBody({ schema: schema(kitTickInput) })
  kit(@Param("id", ParseUUIDPipe) id: string, @Body(body(kitTickInput)) b: z.output<typeof kitTickInput>) {
    return this.shoots.tickKit(id, b.item, b.column, b.done);
  }

  @Post(":id/kit/all")
  @Can("production", "edit")
  @HttpCode(200)
  kitAll(@Param("id", ParseUUIDPipe) id: string, @Body(body(z.object({ column: z.enum(["packed", "received"]) }))) b: { column: "packed" | "received" }) {
    return this.shoots.tickAll(id, b.column);
  }

  @Put(":id/pre-shoot")
  @Can("production", "edit")
  @ApiBody({ schema: schema(preShootTick) })
  pre(@Param("id", ParseUUIDPipe) id: string, @Body(body(preShootTick)) b: z.output<typeof preShootTick>) {
    return this.shoots.tickPreShoot(id, b.item, b.done);
  }

  @Post(":id/start")
  @Can("production", "edit")
  @HttpCode(200)
  start(@Param("id", ParseUUIDPipe) id: string) {
    return this.shoots.start(id);
  }

  @Post(":id/sign")
  @Can("production", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(shootSign) })
  sign(@Param("id", ParseUUIDPipe) id: string, @Body(body(shootSign)) b: z.output<typeof shootSign>) {
    return this.shoots.sign(id, b.as, b.name);
  }

  @Post(":id/videos-shot")
  @Can("production", "edit")
  @HttpCode(200)
  shot(@Param("id", ParseUUIDPipe) id: string) {
    return this.shoots.videosShot(id);
  }

  @Post(":id/incidents")
  @Can("production", "edit")
  @ApiBody({ schema: schema(incidentInput) })
  incident(@Param("id", ParseUUIDPipe) id: string, @Body(body(incidentInput)) b: z.output<typeof incidentInput>) {
    return this.shoots.incident(id, b);
  }

  @Post(":id/incidents/:incidentId/resolve")
  @Can("production", "edit")
  @HttpCode(200)
  resolve(@Param("id", ParseUUIDPipe) id: string, @Param("incidentId", ParseUUIDPipe) incidentId: string) {
    return this.shoots.resolveIncident(id, incidentId);
  }

  @Post(":id/time")
  @Can("production", "edit")
  @ApiBody({ schema: schema(timeLogInput) })
  logTime(@Param("id", ParseUUIDPipe) id: string, @Body(body(timeLogInput)) b: z.output<typeof timeLogInput>) {
    return this.shoots.logTime(id, b);
  }

  @Delete(":id/time/:logId")
  @Can("production", "edit")
  removeTime(@Param("id", ParseUUIDPipe) id: string, @Param("logId", ParseUUIDPipe) logId: string) {
    return this.shoots.removeTime(id, logId);
  }
}

const dayParam = z.iso.date("Use a date like 2026-10-01");

/** Shoots, videos due and to publish, posts and agreements ending, by day — what the person may see. */
@ApiTags("production")
@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  @Staff()
  @ApiQuery({ name: "from" })
  @ApiQuery({ name: "to" })
  events(@Query("from", new ZodPipe(dayParam)) from: string, @Query("to", new ZodPipe(dayParam)) to: string) {
    return this.calendar.events(from, to);
  }
}

/** Time logged on videos and shoots (own roles see only their own). */
@ApiTags("production")
@Controller("time")
export class TimeController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  @Can("production", "view")
  @ApiQuery({ name: "from" })
  @ApiQuery({ name: "to" })
  list(@Query("from", new ZodPipe(dayParam)) from: string, @Query("to", new ZodPipe(dayParam)) to: string) {
    return this.calendar.time(from, to);
  }
}

@ApiTags("publishing")
@Controller("publishing")
export class PublishingController {
  constructor(private readonly publishing: PublishingService) {}

  @Get()
  @Can("publishing", "view")
  @ApiQuery({ name: "month", required: false })
  queue(@Query("month", monthPipe) month?: string) {
    return this.publishing.queue(month);
  }

  @Get("quotas")
  @Can("publishing", "view")
  @ApiQuery({ name: "month", required: false })
  quotas(@Query("month", monthPipe) month?: string) {
    return this.publishing.quotas(month);
  }

  @Post("posts")
  @Can("publishing", "edit")
  @ApiBody({ schema: schema(postInput) })
  schedule(@Body(body(postInput)) b: z.output<typeof postInput>) {
    return this.publishing.schedule(b);
  }

  @Patch("posts/:id")
  @Can("publishing", "edit")
  reschedule(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(body(z.object({ scheduledAt: z.iso.datetime({ offset: true }).optional(), caption: z.string().max(5000).optional() })))
    b: { scheduledAt?: string; caption?: string },
  ) {
    return this.publishing.reschedule(id, b);
  }

  @Delete("posts/:id")
  @Can("publishing", "edit")
  unschedule(@Param("id", ParseUUIDPipe) id: string) {
    return this.publishing.unschedule(id);
  }

  /** Marks a post as published, with its link and a screenshot as proof (approve on publishing). */
  @Post("posts/:id/published")
  @Can("publishing", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(publishedInput) })
  published(@Param("id", ParseUUIDPipe) id: string, @Body(body(publishedInput)) b: z.output<typeof publishedInput>) {
    return this.publishing.published(id, b);
  }
}
