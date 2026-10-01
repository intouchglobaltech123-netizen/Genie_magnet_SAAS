import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { Prisma, TenancyError } from "@gm/db";
import { locals, safePath } from "./request-context.js";

/** The one error shape every endpoint returns (sign-in routes use Better Auth's own `{ message, code }`). */
export interface ErrorBody {
  message: string;
  issues?: { path: string; message: string }[];
  requestId?: string;
}

const log = new Logger("Error");

function toError(exception: unknown): { status: number; body: ErrorBody } {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const r = exception.getResponse();
    if (typeof r === "string") return { status, body: { message: r } };
    const o = r as { message?: unknown; issues?: ErrorBody["issues"] };
    const message = typeof o.message === "string" ? o.message : Array.isArray(o.message) ? o.message.join("; ") : exception.message;
    return { status, body: o.issues ? { message, issues: o.issues } : { message } };
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === "P2002") return { status: HttpStatus.CONFLICT, body: { message: "This already exists." } };
    if (exception.code === "P2025") return { status: HttpStatus.NOT_FOUND, body: { message: "Not found." } };
  }
  if (exception instanceof TenancyError) return { status: HttpStatus.BAD_REQUEST, body: { message: "A valid agency is required." } };
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { message: "Something went wrong on our side. If you report it, quote the request id." } };
}

function report(exception: unknown, req: Request, status: number, requestId?: string) {
  if (status < 500) return;
  // Server-side only: the caller never sees internals.
  log.error(`${req.method} ${safePath(req)} failed`, {
    requestId,
    error: exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
  });
}

/** Global filter: one error shape, with the request id, and no internals in 500 responses. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const { status, body } = toError(exception);
    const requestId = locals(res).requestId;
    report(exception, req, status, requestId);
    res.status(status).json({ ...body, requestId });
  }
}

/** For errors raised before Nest's routing, such as a body that is not valid JSON. */
export function expressErrorHandler() {
  return (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const e = err as { status?: number; type?: string };
    const requestId = locals(res).requestId;
    if (e.type === "entity.parse.failed") return res.status(400).json({ message: "The request body is not valid JSON.", requestId });
    if (e.type === "entity.too.large") return res.status(413).json({ message: "The request body is too large.", requestId });
    const status = e.status && e.status >= 400 && e.status < 500 ? e.status : 500;
    report(err, req, status, requestId);
    return res
      .status(status)
      .json({ message: status === 500 ? "Something went wrong on our side. If you report it, quote the request id." : "Bad request.", requestId });
  };
}
