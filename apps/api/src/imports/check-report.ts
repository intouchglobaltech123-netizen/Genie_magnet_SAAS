import type { ImportReport } from "@gm/shared";

export const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
/** A day as people read it: "30 Oct 2026". */
export const dateText = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The check report kept with each import (P3-12): figures to compare with the sheet's own totals, the rows the
 * importer left out and why, and things worth a look that did not stop the import. Rows are named by their line in
 * the file, as the importer showed them.
 */
export class CheckReport {
  private readonly totals: ImportReport["totals"] = [];
  private readonly notes: ImportReport["notes"] = [];

  private into: string | null = null;

  constructor(private readonly input: { rows: unknown[]; lines?: number[]; fileRows?: number; leftOut: ImportReport["leftOut"] }) {}

  /** The importer put several rows of the file together into one of these ("days"). */
  groupedInto(into: string) {
    this.into = into;
    return this;
  }

  /** The line in the file of the row at this index. */
  line(i: number) {
    const { lines, rows } = this.input;
    return lines?.length === rows.length ? lines[i]! : i + 2;
  }

  total(label: string, value: number | string) {
    this.totals.push({ label, value: typeof value === "number" ? value.toLocaleString("en-IN") : value });
    return this;
  }

  money(label: string, rupees: number) {
    return this.total(label, money(rupees));
  }

  /** One line per group, in the order given, leaving out empty groups: "In Contacted: 4". */
  groups<T>(items: T[], groupOf: (t: T) => string, label: (group: string) => string, order?: string[]) {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(groupOf(item), (counts.get(groupOf(item)) ?? 0) + 1);
    const keys = order ? order.filter((k) => counts.has(k)) : [...counts.keys()].sort();
    for (const k of keys) this.total(label(k), counts.get(k)!);
    return this;
  }

  /** Something worth a look about the row at this index (null for the import as a whole). */
  note(i: number | null, text: string) {
    this.notes.push({ line: i === null ? null : this.line(i), text });
    return this;
  }

  done(imported: number): ImportReport {
    return {
      rows: imported + this.input.leftOut.length,
      ...(this.into && this.input.fileRows && { grouped: { fileRows: this.input.fileRows, into: this.into } }),
      imported,
      leftOut: [...this.input.leftOut].sort((a, b) => a.line - b.line),
      totals: this.totals,
      notes: this.notes.sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
    };
  }
}
