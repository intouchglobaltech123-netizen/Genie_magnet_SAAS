import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  type CadenceInput,
  cadenceInput,
  type CommitmentInput,
  commitmentInput,
  commitmentMark,
  type DecisionInput,
  decisionInput,
  type MeetingInput,
  meetingInput,
  type MeetingUpdate,
  meetingUpdate,
  REVIEW_CADENCES,
  type ReviewCadence,
} from "@gm/shared";
import { Can, Staff, Suite } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { ReviewsService } from "./reviews.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const cadencePipe = new ZodPipe(z.enum(REVIEW_CADENCES));

/** STOP reviews (P5-14), decisions and commitments (P5-16). */
@ApiTags("management")
@Suite("management")
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get("reviews/cadences")
  @Can("reports", "view")
  cadences() {
    return this.reviews.cadences();
  }

  @Put("reviews/cadences/:cadence")
  @Can("reports", "edit")
  @ApiBody({ schema: schema(cadenceInput) })
  saveCadence(@Param("cadence", cadencePipe) cadence: ReviewCadence, @Body(new ZodPipe(cadenceInput)) b: CadenceInput) {
    return this.reviews.saveCadence(cadence, b);
  }

  @Get("reviews/meetings")
  @Staff()
  meetings() {
    return this.reviews.meetings();
  }

  @Post("reviews/meetings")
  @Can("reports", "edit")
  @ApiBody({ schema: schema(meetingInput) })
  schedule(@Body(new ZodPipe(meetingInput)) b: MeetingInput) {
    return this.reviews.schedule(b);
  }

  @Get("reviews/meetings/:id")
  @Staff()
  meeting(@Param("id", ParseUUIDPipe) id: string) {
    return this.reviews.meeting(id);
  }

  @Put("reviews/meetings/:id")
  @Staff()
  @ApiBody({ schema: schema(meetingUpdate) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(meetingUpdate)) b: MeetingUpdate) {
    return this.reviews.update(id, b);
  }

  @Post("reviews/meetings/:id/lock")
  @Can("reports", "approve")
  @HttpCode(200)
  lock(@Param("id", ParseUUIDPipe) id: string) {
    return this.reviews.lock(id);
  }

  @Get("commitments")
  @Staff()
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "mine", required: false })
  commitments(@Query("status") status?: string, @Query("mine") mine?: string) {
    return this.reviews.commitments({ status: status === "open" || status === "done" ? status : undefined, mine: mine === "true" });
  }

  @Post("commitments")
  @Staff()
  @ApiBody({ schema: schema(commitmentInput) })
  commit(@Body(new ZodPipe(commitmentInput)) b: CommitmentInput) {
    return this.reviews.commit(b);
  }

  @Post("commitments/:id/mark")
  @Staff()
  @HttpCode(200)
  @ApiBody({ schema: schema(commitmentMark) })
  mark(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(commitmentMark)) b: z.input<typeof commitmentMark>) {
    return this.reviews.mark(id, b);
  }

  @Post("commitments/:id/done")
  @Staff()
  @HttpCode(200)
  done(@Param("id", ParseUUIDPipe) id: string) {
    return this.reviews.done(id);
  }

  @Get("decisions")
  @Staff()
  decisions() {
    return this.reviews.decisions();
  }

  @Post("decisions")
  @Staff()
  @ApiBody({ schema: schema(decisionInput) })
  decide(@Body(new ZodPipe(decisionInput)) b: DecisionInput) {
    return this.reviews.decide(b);
  }
}
