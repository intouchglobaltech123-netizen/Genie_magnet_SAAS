import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { z } from "zod";

/** Validates a request body with a shared @gm/shared schema — the same schema the web app uses. */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    return r.data;
  }
}
