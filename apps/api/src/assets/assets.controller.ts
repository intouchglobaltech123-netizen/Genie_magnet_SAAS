import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  type AssetInput,
  assetInput,
  type BackInServiceInput,
  backInServiceInput,
  type CheckOutInput,
  checkOutInput,
  type MaintenanceInput,
  maintenanceInput,
  problemInput,
  type ReservationInput,
  reservationInput,
  retireInput,
  type ReturnInput,
  returnInput,
} from "@gm/shared";
import { Can } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { AssetsService } from "./assets.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** Equipment and assets (P5-20). */
@ApiTags("operations")
@Controller("assets")
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  @Can("equipment", "view")
  list() {
    return this.assets.list();
  }

  @Get("reservations")
  @Can("equipment", "view")
  reservations() {
    return this.assets.reservations();
  }

  @Get("people")
  @Can("equipment", "view")
  people() {
    return this.assets.people();
  }

  @Get("shoots")
  @Can("equipment", "view")
  shoots() {
    return this.assets.shoots();
  }

  @Delete("reservations/:reservationId")
  @Can("equipment", "edit")
  cancelReservation(@Param("reservationId", ParseUUIDPipe) reservationId: string) {
    return this.assets.cancelReservation(reservationId);
  }

  @Post("maintenance/:maintenanceId/back-in-service")
  @Can("equipment", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(backInServiceInput) })
  backInService(@Param("maintenanceId", ParseUUIDPipe) maintenanceId: string, @Body(new ZodPipe(backInServiceInput)) b: BackInServiceInput) {
    return this.assets.backInService(maintenanceId, b);
  }

  @Post()
  @Can("equipment", "approve")
  @ApiBody({ schema: schema(assetInput) })
  create(@Body(new ZodPipe(assetInput)) b: AssetInput) {
    return this.assets.create(b);
  }

  @Get(":id")
  @Can("equipment", "view")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.assets.get(id);
  }

  @Put(":id")
  @Can("equipment", "approve")
  @ApiBody({ schema: schema(assetInput) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(assetInput)) b: AssetInput) {
    return this.assets.update(id, b);
  }

  @Post(":id/retire")
  @Can("equipment", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(retireInput) })
  retire(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(retireInput)) b: z.output<typeof retireInput>) {
    return this.assets.retire(id, b.note);
  }

  @Post(":id/check-out")
  @Can("equipment", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(checkOutInput) })
  checkOut(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(checkOutInput)) b: CheckOutInput) {
    return this.assets.checkOut(id, b);
  }

  @Post(":id/return")
  @Can("equipment", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(returnInput) })
  giveBack(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(returnInput)) b: ReturnInput) {
    return this.assets.giveBack(id, b);
  }

  @Post(":id/reservations")
  @Can("equipment", "edit")
  @ApiBody({ schema: schema(reservationInput) })
  reserve(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(reservationInput)) b: ReservationInput) {
    return this.assets.reserve(id, b);
  }

  @Post(":id/problem")
  @Can("equipment", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(problemInput) })
  problem(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(problemInput)) b: z.output<typeof problemInput>) {
    return this.assets.reportProblem(id, b.note);
  }

  @Post(":id/maintenance")
  @Can("equipment", "approve")
  @ApiBody({ schema: schema(maintenanceInput) })
  maintenance(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(maintenanceInput)) b: MaintenanceInput) {
    return this.assets.addMaintenance(id, b);
  }
}
