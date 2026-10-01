// "A missing check fails CI" (P1-11): every endpoint declares @Can(area, level) or @Public(), and the guard
// refuses an endpoint that declares neither.
import "reflect-metadata";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AppModule } from "../app.module.js";
import { AccessService, PERMISSION, PermissionGuard } from "./access.js";

type Controller = { name: string; prototype: Record<string, unknown> };

function routes() {
  const controllers = Reflect.getMetadata("controllers", AppModule) as Controller[];
  return controllers.flatMap((controller) =>
    Object.getOwnPropertyNames(controller.prototype)
      .filter((name) => name !== "constructor" && Reflect.getMetadata("path", controller.prototype[name] as object) !== undefined)
      .map((name) => ({
        route: `${controller.name}.${name}`,
        rule: Reflect.getMetadata(PERMISSION, controller.prototype[name] as object) ?? Reflect.getMetadata(PERMISSION, controller),
      })),
  );
}

describe("permission rules on every endpoint", () => {
  it("finds the API's endpoints", () => {
    expect(routes().length).toBeGreaterThan(10);
  });

  it("has @Can or @Public on each one", () => {
    const missing = routes()
      .filter((r) => r.rule === undefined)
      .map((r) => r.route);
    expect(missing, `Add @Can(area, level) or @Public() to: ${missing.join(", ")}`).toEqual([]);
  });

  it("refuses an endpoint that has neither", async () => {
    const guard = new PermissionGuard(new Reflector(), {} as AccessService);
    const handler = () => undefined;
    class Unmarked {}
    const context = { getHandler: () => handler, getClass: () => Unmarked } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
