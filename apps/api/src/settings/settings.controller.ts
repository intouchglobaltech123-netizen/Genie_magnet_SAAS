import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { agencyProfileInput, type AgencyProfileInput, packageInput, type PackageInput } from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { AgencyService } from "./agency.service.js";
import { PackagesService } from "./packages.service.js";
import { SampleService } from "./sample.service.js";
import { SetupService } from "./setup.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const packageUpdate = packageInput.partial();
const setupHidden = z.object({ hidden: z.boolean() });

/** Settings → Agency profile. Everyone on the team can read it; changing it needs edit on Agency settings. */
@ApiTags("settings")
@Controller("agency")
export class AgencyController {
  constructor(
    private readonly agency: AgencyService,
    private readonly setup: SetupService,
    private readonly sample: SampleService,
  ) {}

  @Get()
  @Staff()
  get() {
    return this.agency.get();
  }

  /** The set-up guide: which steps are done (each ticks itself from the agency's data), and whether it is hidden. */
  @Get("setup")
  @Staff()
  setupStatus() {
    return this.setup.status();
  }

  /** The set-up wizard (P6-06): the agency questionnaire's essentials and what they set up. */
  @Get("setup/wizard")
  @Staff()
  setupWizard() {
    return this.setup.wizard();
  }

  /** Sample data to try things with (P6-06), and removing it with whatever was made for it since. */
  @Post("setup/sample")
  @Can("settings", "edit")
  addSample() {
    return this.sample.add();
  }

  @Delete("setup/sample")
  @Can("settings", "edit")
  removeSample() {
    return this.sample.remove();
  }

  @Put("setup")
  @Can("settings", "edit")
  @ApiBody({ schema: schema(setupHidden) })
  hideSetup(@Body(new ZodPipe(setupHidden)) body: { hidden: boolean }) {
    return this.setup.setHidden(body.hidden);
  }

  @Patch()
  @Can("settings", "edit")
  @ApiBody({ schema: schema(agencyProfileInput) })
  update(@Body(new ZodPipe(agencyProfileInput)) body: AgencyProfileInput) {
    return this.agency.update(body);
  }
}

/** Settings → Packages. Everyone on the team can see them (sales needs them); changing them needs edit on Agency settings. */
@ApiTags("settings")
@Controller("packages")
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get()
  @Staff()
  @ApiQuery({ name: "archived", required: false, description: "1 to include archived packages" })
  list(@Query("archived") archived?: string) {
    return this.packages.list(archived === "1" || archived === "true");
  }

  @Post()
  @Can("settings", "edit")
  @ApiBody({ schema: schema(packageInput) })
  create(@Body(new ZodPipe(packageInput)) body: PackageInput) {
    return this.packages.create(body);
  }

  /** Changes apply to new agreements only; agreements already made keep their terms. */
  @Patch(":id")
  @Can("settings", "edit")
  @ApiBody({ schema: schema(packageUpdate) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(packageUpdate)) body: Partial<PackageInput>) {
    return this.packages.update(id, body);
  }

  @Post(":id/archive")
  @Can("settings", "edit")
  @HttpCode(200)
  archive(@Param("id", ParseUUIDPipe) id: string) {
    return this.packages.setActive(id, false);
  }

  @Post(":id/restore")
  @Can("settings", "edit")
  @HttpCode(200)
  restore(@Param("id", ParseUUIDPipe) id: string) {
    return this.packages.setActive(id, true);
  }

  /** Only a package no agreement uses; otherwise archive it. */
  @Delete(":id")
  @Can("settings", "edit")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.packages.remove(id);
  }
}
