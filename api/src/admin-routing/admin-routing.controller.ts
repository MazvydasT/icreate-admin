import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { map } from 'rxjs';
import { IcreateDataService } from '../icreate-data/icreate-data.service';
import { Config } from '../sql-last-modified/Types/Config';
import openAdminTasksSQL from './SQL/openAdminTasks.sql';
import vehicleLinesSQL from './SQL/vehicleLines.sql';

const lastModifiedConfigForOpenAdminTasks: [Config, ...Config[]] = [
  {
    connectionId: `jlr-ddc1-prod.europe-west1.ods_icreate_change_service_sql_connection`,
    tables: [`engineering_changes`, `change_parts`, `change_lead_programmes`]
  },
  {
    connectionId: `jlr-ddc1-prod.europe-west1.ods_icreate_workflow_sql_connection`,
    tables: [`ACT_HI_PROCINST`, `ACT_HI_TASKINST`]
  }
];

const lastModifiedConfigForVehicleLines: Config = {
  connectionId: `jlr-ddc1-prod.europe-west1.ods_icreate_change_service_sql_connection`,
  tables: [`change_lead_programmes`]
};

@Controller('adminRouting')
export class AdminRoutingController {
  constructor(private readonly icreateDataService: IcreateDataService) {}

  @Get(`openAdminTasks`)
  getOpenAdminTasks(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.icreateDataService.getData(
      openAdminTasksSQL,
      lastModifiedConfigForOpenAdminTasks,
      req,
      res,
      lastModifiedConfigForOpenAdminTasks
    );
  }

  @Get(`vehicleLines`)
  getVehicleLines(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.icreateDataService
      .getData<{
        vehicle_line: string;
      }>(
        vehicleLinesSQL,
        lastModifiedConfigForVehicleLines,
        req,
        res,
        lastModifiedConfigForVehicleLines
      )
      .pipe(map(rows => rows.map(({ vehicle_line }) => vehicle_line)));
  }
}
