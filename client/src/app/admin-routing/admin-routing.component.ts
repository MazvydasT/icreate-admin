import { AsyncPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';

import { concat, first, from, sum, toArray } from 'ix/iterable';
import {
  concatWith,
  filter as filterIx,
  groupBy,
  map as mapIx,
  orderBy,
  orderByDescending,
  tap as tapIx,
} from 'ix/iterable/operators';

import {
  catchError,
  combineLatest,
  ignoreElements,
  map,
  of,
  share,
  Subject,
} from 'rxjs';

import { LuxonPipe } from '../luxon.pipe';
import { AdminRoutingService } from './admin-routing.service';
import { columns } from './configs/columns';
import { RightPanelComponent } from './right-panel/right-panel.component';
import { Bin } from './types/Bin';
import { OpenAdminTask } from './types/OpenAdminTask';
import { TeamName } from './types/Team';

@Component({
  selector: 'app-admin-routing',
  imports: [
    AsyncPipe,
    JsonPipe,

    MatProgressSpinnerModule,
    MatTableModule,

    RightPanelComponent,
  ],
  templateUrl: './admin-routing.component.html',
  styleUrl: './admin-routing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRoutingComponent {
  readonly columns = columns;

  private readonly adminRoutingService = inject(AdminRoutingService);

  readonly vehicleLinesSet = new Subject<Set<string>>();
  private readonly openAdminTasks = combineLatest([
    this.adminRoutingService.getOpenAdminTasks(),
    this.vehicleLinesSet,
  ]).pipe(
    map(([records, vehicleLinesSet]) => {
      const luxon = new LuxonPipe();

      const assignTeam = (record: OpenAdminTask): TeamName => {
        if (record.status.trim().toLocaleLowerCase() == `initiate`) {
          return 'Initiate';
        }

        if (
          record.build_event.replaceAll(` `, ``).toLocaleLowerCase() ==
          `runningchange`
        ) {
          return 'Running Change';
        }

        if (
          !!record.vehicle_line &&
          vehicleLinesSet.has(record.vehicle_line.trim().toLocaleLowerCase())
        ) {
          return 'Absolute';
        }

        return 'Delta';
      };

      return records.map((record) => ({
        ...record,
        landed_at: luxon.transform(record.landed_at.value, `DATETIME_SHORT`),
        landed_at_date: new Date(record.landed_at.value),
        team: assignTeam(record),
      }));
    }),
    share()
  );

  readonly openAdminTasksErrors = this.openAdminTasks.pipe(
    ignoreElements(),
    catchError((err) => of(err))
  );

  readonly displayedColumns = columns.map(({ field }) => field);

  readonly bins = new Subject<{ bins: Bin[]; binsByName: Map<string, Bin> }>();
  private readonly notInTeamBinsByName = new Map<string, Bin>();
  readonly tasksAndBins = combineLatest([this.bins, this.openAdminTasks]).pipe(
    map(([{ bins, binsByName }, tasks]) => {
      bins.forEach((bin) => (bin.workValue = 0));

      const tasksIterable = from(tasks);

      const withHasAssigneeIterable = from(
        toArray(
          tasksIterable.pipe(
            mapIx((task) => ({
              ...task,
              hasAssignee: task.assignee.trim().toLocaleLowerCase() != `admin`,
            }))
          )
        )
      );

      const alreadyAssignedTasks = toArray(
        withHasAssigneeIterable.pipe(
          filterIx(({ hasAssignee }) => hasAssignee),
          mapIx((task) => ({ ...task, newAssignee: undefined })),
          tapIx(({ assignee, part_count, team }) => {
            const bin = binsByName.get(assignee.trim().toLocaleLowerCase());

            if (!!bin) bin.workValue += team == 'Initiate' ? 1 : part_count;
          })
        )
      );

      const unassignedTasks = from(
        toArray(
          withHasAssigneeIterable.pipe(
            filterIx(({ hasAssignee }) => !hasAssignee),
            orderByDescending(({ part_count }) => part_count),
            mapIx((task) => {
              const binWithLowestWorkValue = first(
                from(bins).pipe(
                  orderBy(({ workValue }) => workValue),
                  filterIx(({ teams }) => teams.has(task.team))
                )
              );

              if (!!binWithLowestWorkValue)
                binWithLowestWorkValue.workValue +=
                  task.team == 'Initiate' ? 1 : task.part_count;

              const newAssignee = binWithLowestWorkValue?.name;

              return { ...task, newAssignee };
            })
          )
        )
      );

      const binNames = new Set(
        from(bins).pipe(mapIx(({ name }) => name.trim().toLocaleLowerCase()))
      );

      const tasksNotAssignedToTeamsIterable = from(
        toArray(
          from(alreadyAssignedTasks).pipe(
            concatWith(
              unassignedTasks.pipe(filterIx(({ newAssignee }) => !newAssignee))
            ),
            mapIx((task) => ({
              ...task,
              assignee: task.assignee.trim().toLocaleLowerCase(),
            })),
            filterIx(({ assignee }) => !binNames.has(assignee))
          )
        )
      );

      new Set(this.notInTeamBinsByName.keys())
        .difference(
          new Set(
            tasksNotAssignedToTeamsIterable.pipe(
              mapIx(({ assignee }) => assignee)
            )
          )
        )
        .forEach((assignee) => this.notInTeamBinsByName.delete(assignee));

      const binsNotAssignedToTeam = toArray(
        tasksNotAssignedToTeamsIterable.pipe(
          groupBy(({ assignee }) => assignee),
          mapIx((group) => {
            const assignee = group.key;

            let existingBin = this.notInTeamBinsByName.get(assignee);

            if (!existingBin) {
              existingBin = {
                name: assignee,
                isSelected: false,
                workValue: 0,
                indices: new Set(),
                teams: new Set(),
              };

              this.notInTeamBinsByName.set(assignee, existingBin);
            }

            existingBin.workValue = sum(group, {
              selector: ({ part_count }) => part_count,
            });

            return existingBin;
          }),
          orderByDescending(({ workValue }) => workValue)
        )
      );

      return {
        bins,
        tasks: toArray(concat(alreadyAssignedTasks, unassignedTasks)),
        binsNotAssignedToTeam,
      };
    }),
    share()
  );

  readonly binsNotAssignedToTeam = this.tasksAndBins.pipe(
    map(({ binsNotAssignedToTeam }) => binsNotAssignedToTeam)
  );

  readonly binSelectionChange = new Subject<boolean>();
  readonly tasks = combineLatest([
    this.tasksAndBins,
    this.binSelectionChange,
  ]).pipe(
    map(([{ tasks, bins, binsNotAssignedToTeam }]) => {
      const namesToKeep = new Set(
        from(bins).pipe(
          concatWith(binsNotAssignedToTeam),
          filterIx(({ isSelected }) => isSelected),
          mapIx(({ name }) => name.toLocaleLowerCase())
        )
      );

      const namesToKeepCount = namesToKeep.size;

      return toArray(
        from(tasks).pipe(
          orderBy(({ landed_at_date }) => landed_at_date.getTime()),

          filterIx(({ assignee, newAssignee, hasAssignee }) =>
            namesToKeepCount == 0
              ? true
              : ((hasAssignee || (!hasAssignee && !newAssignee)) &&
                  namesToKeep.has(assignee.trim().toLocaleLowerCase())) ||
                namesToKeep.has(newAssignee?.trim().toLocaleLowerCase() ?? ``)
          )
        )
      );
    }),
    share()
  );
}
