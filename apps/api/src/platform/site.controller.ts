import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { type PublicSite, publicSite } from "@gm/shared";
import { Public } from "../access/access.js";
import { PlatformSettingsService } from "./platform-settings.service.js";

/** The marketing site and pricing page (P6-12): the brand name, the trial and the offered plans with their prices. */
@ApiTags("site")
@Controller("public/site")
export class SiteController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  @Public()
  async site(): Promise<PublicSite> {
    return publicSite(await this.settings.get());
  }
}
