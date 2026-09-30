import { Injectable, Logger } from "@nestjs/common";

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  /** The link the email carries (invitation, password reset), kept for development and tests. */
  link?: string;
}

/**
 * Where sign-in emails go until email sending is built (P1-04): kept in memory and logged,
 * so invitations and password resets can be followed locally and asserted in tests.
 */
@Injectable()
export class Outbox {
  private readonly log = new Logger("Outbox");
  readonly sent: OutboundEmail[] = [];

  async send(email: OutboundEmail) {
    this.sent.push(email);
    this.log.log(`→ ${email.to}: ${email.subject}${email.link ? ` · ${email.link}` : ""}`);
  }

  last(to: string) {
    return [...this.sent].reverse().find((e) => e.to === to);
  }
}
