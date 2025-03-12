import { Module } from '@nestjs/common';
import { AdminRoutingController } from './admin-routing/admin-routing.controller';
import { BigQueryService } from './big-query/big-query.service';
import { IcreateDataService } from './icreate-data/icreate-data.service';
import { MiscController } from './misc/misc.controller';
import { MiscService } from './misc/misc.service';
import { SqlLastModifiedService } from './sql-last-modified/sql-last-modified.service';
import { WorkerService } from './worker/worker.service';

@Module({
  imports: [],
  controllers: [AdminRoutingController, MiscController],
  providers: [BigQueryService, SqlLastModifiedService, IcreateDataService, WorkerService, MiscService]
})
export class AppModule {}
