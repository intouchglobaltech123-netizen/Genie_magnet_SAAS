import { Body, Controller, Get, HttpCode, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { markRead, notificationPreferences, type NotificationPreferences } from "@gm/shared";
import { Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { NotificationsService } from "./notifications.service.js";

/** Each person's own notifications and choices. */
@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Staff()
  @ApiQuery({ name: "unread", required: false })
  list(@Query("unread") unread?: string) {
    return this.notifications.list(unread === "1");
  }

  /** Marks the given notifications (or all) as read. */
  @Post("read")
  @Staff()
  @HttpCode(200)
  @ApiBody({ schema: z.toJSONSchema(markRead, { io: "input" }) as Record<string, unknown> })
  read(@Body(new ZodPipe(markRead)) body: { ids?: string[] }) {
    return this.notifications.markRead(body.ids);
  }

  @Get("preferences")
  @Staff()
  preferences() {
    return this.notifications.preferences();
  }

  @Put("preferences")
  @Staff()
  @ApiBody({ schema: z.toJSONSchema(notificationPreferences, { io: "input" }) as Record<string, unknown> })
  save(@Body(new ZodPipe(notificationPreferences)) body: NotificationPreferences) {
    return this.notifications.savePreferences(body);
  }
}
