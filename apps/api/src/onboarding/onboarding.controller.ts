import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  answerInput,
  checklistTickInput,
  onboardingException,
  onboardingUpdate,
  publicLanguage,
  QUESTIONNAIRE_KINDS,
  type QuestionnaireKind,
  questionnaireDefinition,
  reminderSent,
  startOnboardingInput,
} from "@gm/shared";
import { Can, Public } from "../access/access.js";
import { RateLimit } from "../common/rate-limit.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { OnboardingService } from "./onboarding.service.js";
import { QuestionnairesService } from "./questionnaires.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const kindPipe = new ZodPipe(z.enum(QUESTIONNAIRE_KINDS));
const keyPipe = new ZodPipe(z.string().regex(/^[a-z0-9_]{1,60}$/));

/** The question builder (P1-21): Settings → Onboarding questions. */
@ApiTags("onboarding")
@Controller("questionnaires")
export class QuestionnairesController {
  constructor(private readonly questionnaires: QuestionnairesService) {}

  /** The published version, the draft (if any) and the versions so far. */
  @Get(":kind")
  @Can("onboarding", "view")
  get(@Param("kind", kindPipe) kind: QuestionnaireKind) {
    return this.questionnaires.get(kind);
  }

  @Put(":kind/draft")
  @Can("settings", "edit")
  @ApiBody({ schema: schema(questionnaireDefinition) })
  saveDraft(@Param("kind", kindPipe) kind: QuestionnaireKind, @Body(new ZodPipe(questionnaireDefinition)) body: z.output<typeof questionnaireDefinition>) {
    return this.questionnaires.saveDraft(kind, body);
  }

  /** The draft becomes the next version; onboarding already started keeps its version. */
  @Post(":kind/publish")
  @Can("settings", "edit")
  @HttpCode(200)
  publish(@Param("kind", kindPipe) kind: QuestionnaireKind) {
    return this.questionnaires.publish(kind);
  }

  @Delete(":kind/draft")
  @Can("settings", "edit")
  discard(@Param("kind", kindPipe) kind: QuestionnaireKind) {
    return this.questionnaires.discardDraft(kind);
  }
}

/** Client and agency onboarding (P1-22 to P1-25). */
@ApiTags("onboarding")
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  @Can("onboarding", "view")
  list() {
    return this.onboarding.list();
  }

  /** The agency's own questionnaire; empty before it is started. */
  @Get("agency")
  @Can("onboarding", "view")
  agency() {
    return this.onboarding.agencyQuestionnaire();
  }

  /** Starts it (again at a strategic review; earlier answers are kept). */
  @Post("agency")
  @Can("settings", "edit")
  startAgency() {
    return this.onboarding.startAgencyQuestionnaire();
  }

  @Get(":id")
  @Can("onboarding", "view")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.onboarding.get(id);
  }

  @Patch(":id")
  @Can("onboarding", "edit")
  @ApiBody({ schema: schema(onboardingUpdate) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(onboardingUpdate)) body: z.output<typeof onboardingUpdate>) {
    return this.onboarding.update(id, body);
  }

  /** A new private link for the client; the previous one stops working. The link is shown only in this answer. */
  @Post(":id/link")
  @Can("onboarding", "edit")
  @HttpCode(200)
  link(@Param("id", ParseUUIDPipe) id: string) {
    return this.onboarding.makeLink(id);
  }

  /** An answer given in the agency: assisted mode, or the agency's own questionnaire. An empty value clears it. */
  @Put(":id/answers/:key")
  @Can("onboarding", "edit")
  @ApiBody({ schema: schema(answerInput) })
  answer(@Param("id", ParseUUIDPipe) id: string, @Param("key", keyPipe) key: string, @Body(new ZodPipe(answerInput)) body: z.output<typeof answerInput>) {
    return this.onboarding.answer(id, key, body.value);
  }

  @Put(":id/checklist/:key")
  @Can("onboarding", "edit")
  @ApiBody({ schema: schema(checklistTickInput) })
  tick(@Param("id", ParseUUIDPipe) id: string, @Param("key", keyPipe) key: string, @Body(new ZodPipe(checklistTickInput)) body: { done: boolean }) {
    return this.onboarding.tick(id, key, body.done);
  }

  /** Production may start before onboarding is complete. */
  @Post(":id/exception")
  @Can("onboarding", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(onboardingException) })
  exception(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(onboardingException)) body: { reason: string }) {
    return this.onboarding.exception(id, body.reason);
  }

  @Post(":id/reminders")
  @Can("onboarding", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(reminderSent) })
  reminder(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(reminderSent)) body: z.output<typeof reminderSent>) {
    return this.onboarding.reminderSent(id, body.day, body.channel);
  }

  /** The agency questionnaire's packages table becomes packages (those not there yet). */
  @Post(":id/packages")
  @Can("settings", "edit")
  @HttpCode(200)
  packages(@Param("id", ParseUUIDPipe) id: string) {
    return this.onboarding.packagesFromAnswers(id);
  }
}

@ApiTags("onboarding")
@Controller("clients")
export class ClientOnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** Starts a client's onboarding (done automatically when a deal is won). */
  @Post(":id/onboarding")
  @Can("onboarding", "edit")
  @ApiBody({ schema: schema(startOnboardingInput) })
  start(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(startOnboardingInput)) body: z.output<typeof startOnboardingInput>) {
    return this.onboarding.start(id, body.mode);
  }
}

/** The client's private link: no sign-in, tighter limits, and only that one questionnaire. */
@ApiTags("onboarding")
@Controller("public/onboarding")
export class PublicOnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get(":token")
  @Public()
  @RateLimit({ max: 60, windowSeconds: 60 })
  get(@Param("token") token: string) {
    return this.onboarding.publicGet(token);
  }

  /** Answers save as the client goes; an empty value clears one. */
  @Put(":token/answers/:key")
  @Public()
  @RateLimit({ max: 240, windowSeconds: 60 })
  @ApiBody({ schema: schema(answerInput) })
  answer(@Param("token") token: string, @Param("key", keyPipe) key: string, @Body(new ZodPipe(answerInput)) body: z.output<typeof answerInput>) {
    return this.onboarding.publicAnswer(token, key, body.value);
  }

  @Put(":token/language")
  @Public()
  @RateLimit({ max: 20, windowSeconds: 60 })
  @ApiBody({ schema: schema(publicLanguage) })
  language(@Param("token") token: string, @Body(new ZodPipe(publicLanguage)) body: { language: string }) {
    return this.onboarding.publicLanguage(token, body.language);
  }
}
