import { AsyncPipe, JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  model,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, ActivationEnd, Router } from '@angular/router';
import { Workbook } from 'exceljs';
import { concat, count, first, from, sum, toArray, toMap } from 'ix/iterable';
import {
  concatWith,
  distinct,
  filter as filterIx,
  flatMap,
  groupBy,
  map as mapIx,
  orderBy,
  orderByDescending,
  tap as tapIx,
} from 'ix/iterable/operators';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  filter,
  ignoreElements,
  map,
  Observable,
  of,
  shareReplay,
  skip,
  startWith,
  switchAll,
  switchMap
} from 'rxjs';
import { LuxonPipe } from '../luxon.pipe';
import { AdminRoutingService } from './admin-routing.service';
import { Bin } from './types/Bin';
import { OpenAdminTask } from './types/OpenAdminTask';
import {
  queryParamByTeamName,
  TeamName,
  teamNameByQueryParam,
  teamNames,
} from './types/Team';

@Component({
  selector: 'app-admin-routing',
  imports: [
    MatTableModule,
    MatFormFieldModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatSlideToggleModule,
    FormsModule,
    AsyncPipe,
    JsonPipe,
  ],
  templateUrl: './admin-routing.component.html',
  styleUrl: './admin-routing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRoutingComponent {
  private readonly adminRoutingService = inject(AdminRoutingService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  private readonly activationEndQueryParams = this.router.events.pipe(
    filter((event) => event instanceof ActivationEnd),
    map(({ snapshot: { queryParams } }) => queryParams),
    startWith(this.router.routerState.snapshot.root.queryParams),
    shareReplay(1)
  );

  readonly vehicleLines = toSignal(
    this.activationEndQueryParams.pipe(
      map((queryParams) => {
        let vehicleLines: string | string[] = queryParams[`vl`] ?? [];

        if (!Array.isArray(vehicleLines)) vehicleLines = [vehicleLines];

        return toArray(
          from(vehicleLines).pipe(
            mapIx((vehicleLine) => vehicleLine.trim()),
            filterIx((vehicleLine) => vehicleLine.length > 0),
            distinct({
              comparer: (x, y) =>
                x.toLocaleLowerCase() == y.toLocaleLowerCase(),
            })
          )
        );
      })
    ),
    { requireSync: true }
  );

  private readonly newVehicleLines = new BehaviorSubject(this.vehicleLines());

  private readonly vehicleLinesSet = toObservable(this.vehicleLines).pipe(
    map(
      (vehicleLines) =>
        new Set(
          from(vehicleLines).pipe(
            mapIx((vehicleLine) => vehicleLine.toLocaleLowerCase())
          )
        )
    ),
    shareReplay(1)
  );

  readonly currentVehicleLine = model(``);

  readonly vehicleLinesForAutoComplete = combineLatest([
    this.adminRoutingService.getVehicleLines(),
    this.vehicleLinesSet,
    toObservable(this.currentVehicleLine),
  ]).pipe(
    map(([allVehicleLines, vehicleLinesSet, currentVehicleLine]) =>
      allVehicleLines.filter(
        (vehicleLine) =>
          !vehicleLinesSet.has(vehicleLine.toLocaleLowerCase()) &&
          vehicleLine
            .toLocaleLowerCase()
            .includes((currentVehicleLine ?? ``).toLocaleLowerCase())
      )
    )
  );

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
    shareReplay(1)
  );

  readonly openAdminTasksErrors = this.openAdminTasks.pipe(
    ignoreElements(),
    catchError((err) => of(err))
  );

  readonly teams = teamNames;

  readonly columns = [
    { field: `change_number`, name: `Change` },
    { field: `status`, name: `Status` },
    { field: `vehicle_line`, name: `Vehicle line` },
    { field: `build_event`, name: `Build event` },
    { field: `landed_at`, name: `Landed at`, exportField: `landed_at_date` },
    { field: `assignee`, name: `Assignee` },
    { field: `part_count`, name: `Part count` },
    { field: `team`, name: `Team` },
    { field: `newAssignee`, name: `New assignee` },
  ];

  readonly displayedColumns = this.columns.map(({ field }) => field);

  private readonly binSelectionChange = new BehaviorSubject(true);

  private readonly binsByName = new Map<string, Bin>();
  private readonly bins = toSignal(
    this.activationEndQueryParams.pipe(
      map((queryParams) => {
        const distinctNames = toArray(
          from(teamNameByQueryParam.entries()).pipe(
            flatMap(([queryParamName, teamName]) => {
              let names: string | string[] = queryParams[queryParamName] ?? [];

              if (!Array.isArray(names)) names = [names];

              return from(names).pipe(
                mapIx((name) => ({ name: name.trim(), teamName }))
              );
            }),
            filterIx(({ name }) => name.length > 0),
            distinct({
              comparer: (x, y) =>
                x.name.toLocaleLowerCase() == y.name.toLocaleLowerCase() &&
                x.teamName.toLocaleLowerCase() ==
                  y.teamName.toLocaleLowerCase(),
            }),
            mapIx(({ name, teamName }, index) => ({ name, teamName, index })),
            groupBy(
              ({ name }) => name,
              ({ teamName, index }) => ({ teamName, index })
            ),
            mapIx((group) => ({
              name: group.key,
              teamNames: group.pipe(mapIx(({ teamName }) => teamName)),
              indices: group.pipe(mapIx(({ index }) => index)),
            }))
          )
        );

        new Set(this.binsByName.keys())
          .difference(new Set(distinctNames.map(({ name }) => name)))
          .forEach((name) => this.binsByName.delete(name));

        return distinctNames.map(({ name, teamNames, indices }) => {
          let existingBin = this.binsByName.get(name);

          if (!existingBin) {
            existingBin = {
              name,
              partCount: 0,
              isSelected: false,
              teams: new Set(),
              indices: new Set(),
            };

            this.binsByName.set(name, existingBin);
          }

          existingBin.teams = new Set(teamNames);
          existingBin.indices = new Set(indices);

          return existingBin;
        });
      })
    ),
    { requireSync: true }
  );

  private readonly newBinNames = new BehaviorSubject(
    Object.fromEntries(
      from(this.bins()).pipe(
        flatMap(({ name, teams }) =>
          from(teams).pipe(mapIx((team) => ({ team, name })))
        ),
        groupBy(
          ({ team }) => queryParamByTeamName.get(team)!,
          ({ name }) => name
        ),
        mapIx((group) => [group.key, toArray(group)])
      )
    )
  );

  private readonly notInTeamBinsByName = new Map<string, Bin>();
  readonly tasksAndBins = combineLatest([
    toObservable(this.bins),
    this.openAdminTasks,
  ]).pipe(
    map(([bins, tasks]) => {
      bins.forEach((bin) => (bin.partCount = 0));

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
          tapIx(({ assignee, part_count }) => {
            const bin = this.binsByName.get(
              assignee.trim().toLocaleLowerCase()
            );

            if (!!bin) bin.partCount += part_count;
          })
        )
      );

      const unassignedTasks = from(
        toArray(
          withHasAssigneeIterable.pipe(
            filterIx(({ hasAssignee }) => !hasAssignee),
            orderByDescending(({ part_count }) => part_count),
            mapIx((task) => {
              const binWithLowestPartCount = first(
                from(bins).pipe(
                  orderBy(({ partCount }) => partCount),
                  filterIx(({ teams }) => teams.has(task.team))
                )
              );

              if (!!binWithLowestPartCount)
                binWithLowestPartCount.partCount += task.part_count;

              const newAssignee = binWithLowestPartCount?.name;

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
                partCount: 0,
                indices: new Set(),
                teams: new Set(),
              };

              this.notInTeamBinsByName.set(assignee, existingBin);
            }

            existingBin.partCount = sum(group, {
              selector: ({ part_count }) => part_count,
            });

            return existingBin;
          }),
          orderByDescending(({ partCount }) => partCount)
        )
      );

      return {
        bins,
        tasks: toArray(concat(alreadyAssignedTasks, unassignedTasks)),
        binsNotAssignedToTeam,
      };
    }),
    shareReplay(1)
  );

  private readonly binsWithPartCount = this.tasksAndBins.pipe(
    map(({ bins }) => of(bins)),
    startWith(toObservable(this.bins)),
    switchAll(),
    shareReplay(1)
  );

  readonly binsWithPartCountByTeam = this.binsWithPartCount.pipe(
    map((bins) =>
      toMap(
        from(bins).pipe(
          flatMap((bin) => {
            const indicesArray = Array.from(bin.indices);
            return from(bin.teams).pipe(
              mapIx((team, index) => ({
                team,
                bin,
                index: indicesArray[index],
              }))
            );
          }),
          orderBy(({ index }) => index),
          groupBy(
            ({ team }) => team,
            ({ bin }) => bin
          )
        ),
        {
          keySelector: ({ key }) => key,
          elementSelector: (group) => toArray(group),
        }
      )
    )
  );

  readonly binsNotAssignedToTeam = this.tasksAndBins.pipe(
    map(({ binsNotAssignedToTeam }) => binsNotAssignedToTeam),
    shareReplay(1)
  );

  readonly maxPartCount = combineLatest([
    this.binsWithPartCount,
    this.binsNotAssignedToTeam,
  ]).pipe(
    map(([binsWithPartCount, binsNotAssignedToTeam]) =>
      first(
        concat(binsWithPartCount, binsNotAssignedToTeam).pipe(
          mapIx((bin) => bin.partCount),
          orderByDescending((partCount) => partCount)
        )
      )
    )
  );

  readonly selectedBinCount = combineLatest([
    this.tasksAndBins,
    this.binSelectionChange,
  ]).pipe(
    map(([{ bins, binsNotAssignedToTeam }]) => ({
      selected: count(
        concat(bins, binsNotAssignedToTeam).pipe(
          filterIx(({ isSelected }) => isSelected)
        )
      ),
      all: bins.length + binsNotAssignedToTeam.length,
    }))
  );

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
          orderByDescending(({ landed_at_date }) => landed_at_date.getTime()),

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
    shareReplay(1)
  );

  readonly downloadLink = this.tasks.pipe(
    switchMap(async (tasks) => {
      const dataToExport = toArray(
        from(tasks).pipe(
          mapIx((row: any) =>
            toArray(
              from(this.columns).pipe(
                mapIx(({ exportField, field }) => row[exportField ?? field])
              )
            )
          )
        )
      );

      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet(`Data`);

      worksheet.addTable({
        name: `DataTable`,
        ref: `A1`,
        style: {
          theme: `TableStyleMedium4`,
          showRowStripes: true,
        },
        columns: this.columns.map(({ name }) => ({ name, filterButton: true })),
        rows: dataToExport,
      });

      const buffer = await workbook.xlsx.writeBuffer({
        useSharedStrings: true,
      });

      return new Blob([buffer]);
    }),
    switchMap(
      (blob) =>
        new Observable<{ url: string; name: string }>((subscriber) => {
          const url = URL.createObjectURL(blob);

          subscriber.next({
            url,
            name: `Admin routing ${new LuxonPipe().transform(
              new Date(),
              `yyyyMMddHHmmss`
            )}.xlsx`,
          });

          return () => URL.revokeObjectURL(url);
        })
    )
  );

  constructor(private readonly destroyRef: DestroyRef) {
    const updateURLSubscription = combineLatest([
      this.newVehicleLines,
      this.newBinNames,
    ])
      .pipe(skip(1))
      .subscribe(([newVehicleLines, newBinNames]) => {
        this.router.navigate([], {
          relativeTo: this.activatedRoute,
          queryParams: { vl: newVehicleLines, ...newBinNames },
        });
      });

    this.destroyRef.onDestroy(() => updateURLSubscription.unsubscribe());
  }

  removeBin(bin: Bin, teamName: TeamName) {
    bin.teams.delete(teamName);

    const newBinNames = Object.fromEntries(
      toArray(
        from(this.bins()).pipe(
          filterIx(({ teams }) => teams.size > 0),
          flatMap(({ name, teams }) =>
            from(teams).pipe(mapIx((teamName) => ({ name, teamName })))
          ),
          groupBy(
            ({ teamName }) => queryParamByTeamName.get(teamName)!,
            ({ name }) => name
          ),
          mapIx((group) => [group.key, toArray(group)])
        )
      )
    );

    this.newBinNames.next(newBinNames);
  }

  addBin(binName: string, teamName: TeamName) {
    binName = binName.trim();

    if (binName.length == 0) return;

    const newBinNames = Object.fromEntries(
      toArray(
        from(this.bins()).pipe(
          flatMap(({ name, teams }) => {
            return from(teams).pipe(mapIx((teamName) => ({ name, teamName })));
          }),
          concatWith([{ name: binName, teamName }]),
          distinct({
            comparer(x, y) {
              return (
                x.name.toLocaleLowerCase() == y.name.toLocaleLowerCase() &&
                x.teamName.toLocaleLowerCase() == y.teamName.toLocaleLowerCase()
              );
            },
          }),
          groupBy(
            ({ teamName }) => queryParamByTeamName.get(teamName)!,
            ({ name }) => name
          ),
          mapIx((group) => [group.key, toArray(group)])
        )
      )
    );

    this.newBinNames.next(newBinNames);
  }

  onBinSelectionChange(isSelected: boolean, bin: Bin) {
    bin.isSelected = isSelected;

    this.binSelectionChange.next(true);
  }

  addVehicleLine(vehicleLine: string) {
    vehicleLine = vehicleLine.trim();

    if (vehicleLine.length == 0) return;

    this.newVehicleLines.next(
      toArray(
        from(this.vehicleLines()).pipe(
          concatWith([vehicleLine]),
          distinct({
            comparer: (x, y) => x.toLocaleLowerCase() == y.toLocaleLowerCase(),
          })
        )
      )
    );
  }

  removeVehicleLine(vehicleLineIndex: number) {
    this.newVehicleLines.next(
      toArray(
        from(this.vehicleLines()).pipe(
          filterIx((_, index) => index != vehicleLineIndex)
        )
      )
    );
  }
}
