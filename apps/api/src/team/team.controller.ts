import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { invitationInput, type InvitationInput, memberUpdate, type MemberUpdate, roleInput, type RoleInput, roleUpdate, type RoleUpdate } from "@gm/shared";
import { Can } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { RolesService } from "./roles.service.js";
import { TeamService } from "./team.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** People in the agency and their invitations (Settings → Team). */
@ApiTags("team")
@Controller("team")
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @Can("team", "view")
  list() {
    return this.team.list();
  }

  /** Emails an invitation link (valid 7 days). Accepting it needs a signed-in, confirmed email address. */
  @Post("invitations")
  @Can("team", "edit")
  @ApiBody({ schema: schema(invitationInput) })
  invite(@Body(new ZodPipe(invitationInput)) body: InvitationInput) {
    return this.team.invite(body);
  }

  @Delete("invitations/:id")
  @Can("team", "edit")
  @HttpCode(204)
  cancel(@Param("id", ParseUUIDPipe) id: string) {
    return this.team.cancelInvitation(id);
  }

  @Patch("members/:id")
  @Can("team", "edit")
  @ApiBody({ schema: schema(memberUpdate) })
  changeRole(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(memberUpdate)) body: MemberUpdate) {
    return this.team.changeRole(id, body);
  }

  /** Access ends at once, even for a session that is still open. */
  @Delete("members/:id")
  @Can("team", "edit")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.team.remove(id);
  }
}

/** Roles and the permission matrix (Settings → Roles). */
@ApiTags("roles")
@Controller("roles")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  /** Everyone who can see the team can see the roles, so they know what each person may do. */
  @Get()
  @Can("team", "view")
  list() {
    return this.roles.list();
  }

  /** A new role, from scratch, copied from another role (`copyFrom`), or with a full matrix. */
  @Post()
  @Can("roles", "edit")
  @ApiBody({ schema: schema(roleInput) })
  create(@Body(new ZodPipe(roleInput)) body: RoleInput) {
    return this.roles.create(body);
  }

  /** Rename, describe, or change what the role may see and do. Applies from each member's next request. */
  @Patch(":key")
  @Can("roles", "edit")
  @ApiBody({ schema: schema(roleUpdate) })
  update(@Param("key") key: string, @Body(new ZodPipe(roleUpdate)) body: RoleUpdate) {
    return this.roles.update(key, body);
  }

  @Delete(":key")
  @Can("roles", "edit")
  @HttpCode(204)
  remove(@Param("key") key: string) {
    return this.roles.remove(key);
  }
}
