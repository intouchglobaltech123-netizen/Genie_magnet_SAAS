import { describe, expect, it } from "vitest";
import { achievedOf, compositeOf, DEFAULT_PERFORMANCE, kraTemplateInput, playerOf } from "./performance.js";

const kra = (key: string, target: number, weight: number, actual: number | null, lowerIsBetter = false) => ({ key, target, weight, actual, lowerIsBetter });

describe("a month's score", () => {
  it("counts each KRA's achievement up to its target, times its weight; lower is better counts the other way", () => {
    expect(achievedOf({ target: 14, actual: 7, lowerIsBetter: false })).toBe(0.5);
    expect(achievedOf({ target: 14, actual: 20, lowerIsBetter: false })).toBe(1);
    expect(achievedOf({ target: 1.5, actual: 3, lowerIsBetter: true })).toBe(0.5);
    expect(achievedOf({ target: 1.5, actual: 0, lowerIsBetter: true })).toBe(1);
    expect(achievedOf({ target: 10, actual: null, lowerIsBetter: false })).toBeNull();
    const kras = [kra("videos", 14, 50, 7), kra("qc", 85, 30, 85), kra("revisions", 1.5, 20, 3, true)];
    expect(compositeOf(kras, null)).toEqual({ raw: 25 + 30 + 10, score: 65, gated: false });
  });

  it("is capped by the quality gate when its KRA falls below the threshold", () => {
    const kras = [kra("videos", 14, 70, 14), kra("qc", 85, 30, 70)];
    expect(compositeOf(kras, { key: "qc", threshold: 80, cap: 60 })).toEqual({ raw: 94.7, score: 60, gated: true });
    expect(compositeOf(kras, { key: "qc", threshold: 60, cap: 60 }).gated).toBe(false);
  });

  it("comes from a template whose weights add up to 100 and whose gate is one of its KRAs", () => {
    const base = { name: "Video Editor", kras: [{ key: "a", name: "Videos", target: 14, weight: 60 }] };
    expect(kraTemplateInput.safeParse(base).error?.issues[0]?.message).toBe("The weights add up to 100");
    const ok = { ...base, kras: [...base.kras, { key: "b", name: "On time", target: 95, weight: 40, metric: "on_time" }] };
    expect(kraTemplateInput.safeParse(ok).success).toBe(true);
    expect(kraTemplateInput.safeParse({ ...ok, gate: { key: "z", threshold: 1, cap: 1 } }).error?.issues[0]?.message).toBe("Choose one of the KRAs");
  });
});

describe("the player rating", () => {
  it("is A when strong on both, B for competence or commitment, C below on both — by the agency's bar", () => {
    const r = (skill: number, knowledge: number, selfImage: number, motive: number, trait: number) => ({ skill, knowledge, selfImage, motive, trait });
    expect(playerOf(r(5, 4, 4, 4, 4), DEFAULT_PERFORMANCE)).toBe("A");
    expect(playerOf(r(5, 4, 3, 4, 3), DEFAULT_PERFORMANCE)).toBe("B_competence");
    expect(playerOf(r(3, 3, 4, 5, 4), DEFAULT_PERFORMANCE)).toBe("B_commitment");
    expect(playerOf(r(3, 3, 3, 3, 4), DEFAULT_PERFORMANCE)).toBe("C");
    expect(playerOf(r(3, 3, 3, 3, 4), { ...DEFAULT_PERFORMANCE, bar: 3 })).toBe("A");
  });
});
