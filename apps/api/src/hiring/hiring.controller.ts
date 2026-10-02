import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  type CandidateInput,
  candidateInput,
  candidateMove,
  hiringSettingsInput,
  type InterviewInput,
  interviewInput,
  type OfferInput,
  offerInput,
  type OpeningInput,
  openingInput,
  type ScorecardInput,
  scorecardInput,
} from "@gm/shared";
import { Can, Staff, Suite } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { HiringService } from "./hiring.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const decision = z
  .object({ approved: z.boolean(), note: z.string().trim().max(500).optional() })
  .refine((d) => d.approved || !!d.note, { path: ["note"], message: "Say why they are not taken" });
const answer = z.object({ accepted: z.boolean() });

/**
 * Hiring (P5-10). HR keeps openings and candidates; hiring managers and interviewers see theirs and fill in
 * scorecards; approving a hire needs HR approval.
 */
@ApiTags("hiring")
@Suite("people")
@Controller("hiring")
export class HiringController {
  constructor(private readonly hiring: HiringService) {}

  @Get("settings")
  @Staff()
  settings() {
    return this.hiring.settings();
  }

  @Put("settings")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(hiringSettingsInput) })
  updateSettings(@Body(new ZodPipe(hiringSettingsInput)) b: z.input<typeof hiringSettingsInput>) {
    return this.hiring.updateSettings(b);
  }

  @Get("openings")
  @Staff()
  openings() {
    return this.hiring.openings();
  }

  @Post("openings")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(openingInput) })
  createOpening(@Body(new ZodPipe(openingInput)) b: OpeningInput) {
    return this.hiring.createOpening(b);
  }

  @Get("openings/:id")
  @Staff()
  opening(@Param("id", ParseUUIDPipe) id: string) {
    return this.hiring.opening(id);
  }

  @Put("openings/:id")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(openingInput) })
  updateOpening(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(openingInput)) b: OpeningInput) {
    return this.hiring.updateOpening(id, b);
  }

  @Get("candidates")
  @Staff()
  @ApiQuery({ name: "openingId", required: false })
  candidates(@Query("openingId") openingId?: string) {
    return this.hiring.candidates(openingId && z.uuid().safeParse(openingId).success ? openingId : undefined);
  }

  @Post("candidates")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(candidateInput) })
  addCandidate(@Body(new ZodPipe(candidateInput)) b: CandidateInput) {
    return this.hiring.addCandidate(b);
  }

  @Get("candidates/:id")
  @Staff()
  candidate(@Param("id", ParseUUIDPipe) id: string) {
    return this.hiring.candidate(id);
  }

  @Put("candidates/:id")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(candidateInput) })
  updateCandidate(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(candidateInput)) b: CandidateInput) {
    return this.hiring.updateCandidate(id, b);
  }

  @Put("candidates/:id/stage")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(candidateMove) })
  move(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(candidateMove)) b: z.output<typeof candidateMove>) {
    return this.hiring.move(id, b.stage, b.reason);
  }

  @Post("candidates/:id/interviews")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(interviewInput) })
  schedule(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(interviewInput)) b: InterviewInput) {
    return this.hiring.schedule(id, b);
  }

  @Delete("interviews/:id")
  @Can("hr", "edit")
  cancelInterview(@Param("id", ParseUUIDPipe) id: string) {
    return this.hiring.cancelInterview(id);
  }

  /** The signed-in person's scorecard (the service checks they interview the candidate, manage the opening, or are HR). */
  @Put("candidates/:id/scorecard")
  @Staff()
  @ApiBody({ schema: schema(scorecardInput) })
  score(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(scorecardInput)) b: ScorecardInput) {
    return this.hiring.score(id, b);
  }

  @Post("candidates/:id/approval")
  @Can("hr", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(decision) })
  approve(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(decision)) b: z.output<typeof decision>) {
    return this.hiring.approve(id, b.approved, b.note);
  }

  @Put("candidates/:id/offer")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(offerInput) })
  offer(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(offerInput)) b: OfferInput) {
    return this.hiring.offer(id, b);
  }

  @Post("candidates/:id/offer/answer")
  @Can("hr", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(answer) })
  answer(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(answer)) b: z.output<typeof answer>) {
    return this.hiring.answer(id, b.accepted);
  }

  @Post("candidates/:id/join")
  @Can("hr", "edit")
  @HttpCode(200)
  join(@Param("id", ParseUUIDPipe) id: string) {
    return this.hiring.join(id);
  }
}
