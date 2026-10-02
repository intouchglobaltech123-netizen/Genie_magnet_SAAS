import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { sopCheckInput, type SopInput, sopInput, type SopRunInput, sopRunInput, type SopVersionInput, sopVersionInput } from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { SopsService } from "./sops.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const decision = z
  .object({ approved: z.boolean(), note: z.string().trim().max(500).default("") })
  .refine((d) => d.approved || !!d.note, { path: ["note"], message: "Say what to change" });

/** SOPs and checklists (P5-17). */
@ApiTags("management")
@Controller("sops")
export class SopsController {
  constructor(private readonly sops: SopsService) {}

  @Get()
  @Staff()
  list() {
    return this.sops.list();
  }

  @Post()
  @Can("reports", "edit")
  @ApiBody({ schema: schema(sopInput) })
  create(@Body(new ZodPipe(sopInput)) b: SopInput) {
    return this.sops.create(b);
  }

  @Get("runs")
  @Staff()
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "mine", required: false })
  runs(@Query("status") status?: string, @Query("mine") mine?: string) {
    return this.sops.runs({ status: status === "submitted" || status === "passed" || status === "failed" ? status : undefined, mine: mine === "true" });
  }

  @Post("runs/:runId/check")
  @Staff()
  @HttpCode(200)
  @ApiBody({ schema: schema(sopCheckInput) })
  check(@Param("runId", ParseUUIDPipe) runId: string, @Body(new ZodPipe(sopCheckInput)) b: z.output<typeof sopCheckInput>) {
    return this.sops.check(runId, b.passed, b.note);
  }

  @Put("versions/:versionId")
  @Staff()
  @ApiBody({ schema: schema(sopVersionInput) })
  saveVersion(@Param("versionId", ParseUUIDPipe) versionId: string, @Body(new ZodPipe(sopVersionInput)) b: SopVersionInput) {
    return this.sops.saveVersion(versionId, b);
  }

  @Post("versions/:versionId/submit")
  @Staff()
  @HttpCode(200)
  submit(@Param("versionId", ParseUUIDPipe) versionId: string) {
    return this.sops.submit(versionId);
  }

  @Post("versions/:versionId/decision")
  @Staff()
  @HttpCode(200)
  @ApiBody({ schema: schema(decision) })
  decide(@Param("versionId", ParseUUIDPipe) versionId: string, @Body(new ZodPipe(decision)) b: z.output<typeof decision>) {
    return this.sops.decide(versionId, b.approved, b.note);
  }

  @Get(":id")
  @Staff()
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.sops.get(id);
  }

  @Put(":id")
  @Can("reports", "edit")
  @ApiBody({ schema: schema(sopInput) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(sopInput)) b: SopInput) {
    return this.sops.update(id, b);
  }

  @Post(":id/versions")
  @Staff()
  newDraft(@Param("id", ParseUUIDPipe) id: string) {
    return this.sops.newDraft(id);
  }

  @Get(":id/runs")
  @Staff()
  sopRuns(@Param("id", ParseUUIDPipe) id: string) {
    return this.sops.runs({ sopId: id });
  }

  @Post(":id/runs")
  @Staff()
  @ApiBody({ schema: schema(sopRunInput) })
  run(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(sopRunInput)) b: SopRunInput) {
    return this.sops.run(id, b);
  }
}
