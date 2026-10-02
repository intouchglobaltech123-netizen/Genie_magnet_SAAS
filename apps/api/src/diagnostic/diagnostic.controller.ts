import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { type DiagnosticInput, diagnosticInput, FITMENT_QUADRANTS, type RoadMapInput, roadMapInput, type ScenarioInput, scenarioInput } from "@gm/shared";
import { Can } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { DiagnosticService } from "./diagnostic.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const fitment = z.object({ fitment: z.enum(FITMENT_QUADRANTS).nullable() });

/** The business diagnostic, road map and scenarios (P5-18): seen by those who may see reviews, changed by those who may edit them. */
@ApiTags("management")
@Controller()
export class DiagnosticController {
  constructor(private readonly diagnostic: DiagnosticService) {}

  @Get("diagnostic")
  @Can("reports", "view")
  view() {
    return this.diagnostic.view();
  }

  @Post("diagnostic")
  @Can("reports", "edit")
  @ApiBody({ schema: schema(diagnosticInput) })
  take(@Body(new ZodPipe(diagnosticInput)) b: DiagnosticInput) {
    return this.diagnostic.take(b);
  }

  @Get("diagnostic/clients")
  @Can("reports", "view")
  clients() {
    return this.diagnostic.clients();
  }

  @Put("diagnostic/clients/:id")
  @Can("reports", "edit")
  @ApiBody({ schema: schema(fitment) })
  setFitment(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(fitment)) b: z.output<typeof fitment>) {
    return this.diagnostic.setFitment(id, b.fitment);
  }

  @Get("road-map")
  @Can("reports", "view")
  roadMap() {
    return this.diagnostic.roadMap();
  }

  @Post("road-map")
  @Can("reports", "edit")
  @ApiBody({ schema: schema(roadMapInput) })
  addItem(@Body(new ZodPipe(roadMapInput)) b: RoadMapInput) {
    return this.diagnostic.saveItem(null, b);
  }

  @Post("road-map/draft")
  @Can("reports", "edit")
  @HttpCode(200)
  draft() {
    return this.diagnostic.draftRoadMap();
  }

  @Put("road-map/:id")
  @Can("reports", "edit")
  @ApiBody({ schema: schema(roadMapInput) })
  saveItem(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(roadMapInput)) b: RoadMapInput) {
    return this.diagnostic.saveItem(id, b);
  }

  @Delete("road-map/:id")
  @Can("reports", "edit")
  removeItem(@Param("id", ParseUUIDPipe) id: string) {
    return this.diagnostic.removeItem(id);
  }

  @Get("scenarios")
  @Can("reports", "view")
  scenarios() {
    return this.diagnostic.scenarios();
  }

  @Get("scenarios/baseline")
  @Can("reports", "view")
  baseline() {
    return this.diagnostic.baseline();
  }

  @Post("scenarios")
  @Can("reports", "edit")
  @ApiBody({ schema: schema(scenarioInput) })
  addScenario(@Body(new ZodPipe(scenarioInput)) b: ScenarioInput) {
    return this.diagnostic.saveScenario(null, b);
  }

  @Put("scenarios/:id")
  @Can("reports", "edit")
  @ApiBody({ schema: schema(scenarioInput) })
  saveScenario(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(scenarioInput)) b: ScenarioInput) {
    return this.diagnostic.saveScenario(id, b);
  }

  @Delete("scenarios/:id")
  @Can("reports", "edit")
  removeScenario(@Param("id", ParseUUIDPipe) id: string) {
    return this.diagnostic.removeScenario(id);
  }
}
