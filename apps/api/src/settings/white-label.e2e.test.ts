// White-label (P6-07): the agency's colour in its team's own app when it chooses, and its own address for the links
// it sends clients — verified by a DNS record it adds, before any link uses it or any certificate is issued for it.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AgencyProfile, Me, PortalDomain } from "@gm/shared";
import { type Agent, ORIGIN, type SeededApp, startSeededApp } from "../test/seeded-app.js";
import { DnsLookup } from "./portal-domain.service.js";

let t: SeededApp;
let jana: Agent; // owner of Genie Magnet
let divya: Agent; // editor: cannot change settings
let zara: Agent; // owner of Zen Studio
let dns: DnsLookup;
const anon = () => request(t.app.getHttpServer());
const me = async (a: Agent) => (await a.get("/me").expect(200)).body as Me;

beforeAll(async () => {
  t = await startSeededApp({ PORTAL_CNAME_TARGET: "clients.genie.test" });
  [jana, divya, zara] = await Promise.all(["jana@geniemagnet.test", "divya@geniemagnet.test", "zara@zenstudio.test"].map((e) => t.signInAs(e)));
  dns = t.app.get(DnsLookup);
  dns.txt = async () => [];
  dns.cname = async () => [];
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("the agency's colour in its own app", () => {
  it("is used when the agency chooses, and only with a colour set", async () => {
    expect((await me(jana)).branding).toEqual({ name: "Genie Magnet", logo: null, color: expect.any(String), inApp: false });
    const profile = (await jana.patch("/agency").send({ appBranding: true, brandColor: "#0F766E" }).expect(200)).body as AgencyProfile;
    expect(profile.appBranding).toBe(true);
    expect((await me(jana)).branding).toMatchObject({ color: "#0F766E", inApp: true });
    expect((await me(divya)).branding).toMatchObject({ inApp: true }); // the whole team sees it
    await jana.patch("/agency").send({ brandColor: null }).expect(200);
    expect((await me(jana)).branding).toMatchObject({ color: null, inApp: false });
    await divya.patch("/agency").send({ appBranding: false }).expect(403);
  });
});

describe("the agency's own portal address", () => {
  let contact: { clientId: string; contactId: string };
  const link = async () =>
    ((await jana.post(`/clients/${contact.clientId}/contacts/${contact.contactId}/portal-link`).expect(201)).body as { link: string }).link;

  beforeAll(async () => {
    const [client] = (await jana.get("/clients").expect(200)).body as { id: string; contacts: { id: string }[] }[];
    contact = { clientId: client!.id, contactId: client!.contacts[0]!.id };
  });

  it("is added by someone who keeps the settings, with the DNS records to add", async () => {
    expect((await jana.get("/agency/portal-domain").expect(200)).body).toEqual({});
    await divya.put("/agency/portal-domain").send({ domain: "portal.geniemagnet.test" }).expect(403);
    expect((await jana.put("/agency/portal-domain").send({ domain: "geniemagnet.test" }).expect(400)).body.issues[0]).toMatchObject({ path: "domain" });
    expect((await jana.put("/agency/portal-domain").send({ domain: "gm.clients.genie.test" }).expect(409)).body.message).toBe(
      "Use your own agency's address, not the platform's.",
    );
    const d = (await jana.put("/agency/portal-domain").send({ domain: "https://Portal.GenieMagnet.test/" }).expect(200)).body as PortalDomain;
    expect(d).toMatchObject({ domain: "portal.geniemagnet.test", verifiedAt: null, pointed: null });
    expect(d.records).toEqual([
      { type: "CNAME", name: "portal.geniemagnet.test", value: "clients.genie.test" },
      { type: "TXT", name: "_portal-verify.portal.geniemagnet.test", value: expect.stringMatching(/^portal-verify=[0-9a-f]{32}$/) },
    ]);
    expect((await zara.put("/agency/portal-domain").send({ domain: "portal.geniemagnet.test" }).expect(409)).body.message).toBe(
      "Another workspace uses that address.",
    );
  });

  it("is used for client links only once its DNS record is seen, and only then may get a certificate", async () => {
    const d = (await jana.get("/agency/portal-domain").expect(200)).body as PortalDomain;
    expect((await jana.post("/agency/portal-domain/check").expect(200)).body).toMatchObject({ verifiedAt: null, pointed: false });
    await anon().get("/domains/allowed?domain=portal.geniemagnet.test").expect(404);
    expect(await link()).toMatch(new RegExp(`^${ORIGIN}/app/c/[A-Za-z0-9_-]+$`));

    dns.txt = async (name) => (name === "_portal-verify.portal.geniemagnet.test" ? [d.records[1]!.value, "v=spf1 -all"] : []);
    dns.cname = async (name) => (name === "portal.geniemagnet.test" ? ["clients.genie.test."] : []);
    const checked = (await jana.post("/agency/portal-domain/check").expect(200)).body as PortalDomain;
    expect(checked.verifiedAt).not.toBeNull();
    expect(checked.pointed).toBe(true);
    expect((await anon().get("/domains/allowed?domain=Portal.GenieMagnet.test").expect(200)).body).toEqual({ allowed: true });
    await anon().get("/domains/allowed?domain=portal.zenstudio.test").expect(404);

    const own = await link();
    expect(own).toMatch(/^https:\/\/portal\.geniemagnet\.test\/c\/[A-Za-z0-9_-]+$/);
    await anon()
      .get(`/portal/${own.split("/c/")[1]}`)
      .expect(200); // the same portal behind it
  });

  it("can be removed, and links go back to the platform's address", async () => {
    await divya.delete("/agency/portal-domain").expect(403);
    await jana.delete("/agency/portal-domain").expect(200);
    expect((await jana.get("/agency/portal-domain").expect(200)).body).toEqual({});
    await anon().get("/domains/allowed?domain=portal.geniemagnet.test").expect(404);
    expect(await link()).toMatch(new RegExp(`^${ORIGIN}/app/c/`));
  });
});
