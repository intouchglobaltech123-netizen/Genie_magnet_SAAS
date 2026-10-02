import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { type ProjectInput, projectInput, type ProjectSettingsInput, projectSettingsInput, type TaskInput, taskInput, taskStatusInput } from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { ProjectsService } from "./projects.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** Projects (P5-21). */
@ApiTags("operations")
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @Staff()
  list() {
    return this.projects.projects();
  }

  @Get("settings")
  @Staff()
  settings() {
    return this.projects.settings();
  }

  @Put("settings")
  @Can("projects", "edit")
  @ApiBody({ schema: schema(projectSettingsInput) })
  saveSettings(@Body(new ZodPipe(projectSettingsInput)) b: ProjectSettingsInput) {
    return this.projects.saveSettings(b);
  }

  @Post()
  @Can("projects", "edit")
  @ApiBody({ schema: schema(projectInput) })
  create(@Body(new ZodPipe(projectInput)) b: ProjectInput) {
    return this.projects.createProject(b);
  }

  @Get(":id")
  @Staff()
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.projects.project(id);
  }

  @Put(":id")
  @Staff()
  @ApiBody({ schema: schema(projectInput) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(projectInput)) b: ProjectInput) {
    return this.projects.updateProject(id, b);
  }
}

/** Tasks (P5-21). */
@ApiTags("operations")
@Controller("tasks")
export class TasksController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @Staff()
  @ApiQuery({ name: "scope", required: false, description: "mine (default) or all" })
  @ApiQuery({ name: "ownerId", required: false })
  list(@Query("scope") scope?: string, @Query("ownerId") ownerId?: string) {
    return this.projects.tasks({ scope: scope === "all" ? "all" : "mine", ownerId: ownerId || undefined });
  }

  @Get("people")
  @Staff()
  people() {
    return this.projects.people();
  }

  @Post()
  @Staff()
  @ApiBody({ schema: schema(taskInput) })
  create(@Body(new ZodPipe(taskInput)) b: TaskInput) {
    return this.projects.createTask(b);
  }

  @Post("from-commitment/:commitmentId")
  @Staff()
  fromCommitment(@Param("commitmentId", ParseUUIDPipe) commitmentId: string) {
    return this.projects.fromCommitment(commitmentId);
  }

  @Put(":id")
  @Staff()
  @ApiBody({ schema: schema(taskInput) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(taskInput)) b: TaskInput) {
    return this.projects.updateTask(id, b);
  }

  @Post(":id/status")
  @Staff()
  @HttpCode(200)
  @ApiBody({ schema: schema(taskStatusInput) })
  status(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(taskStatusInput)) b: z.output<typeof taskStatusInput>) {
    return this.projects.setStatus(id, b.status);
  }

  @Delete(":id")
  @Staff()
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.projects.removeTask(id);
  }
}
