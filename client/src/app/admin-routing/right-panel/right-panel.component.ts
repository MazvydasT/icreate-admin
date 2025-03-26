import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  model,
} from '@angular/core';
import {
  outputFromObservable,
  outputToObservable,
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ActivationEnd, Router } from '@angular/router';

import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { concat, count, first, from, toArray, toMap } from 'ix/Ix.iterable';
import {
  concatWith,
  distinct,
  filter as filterIx,
  flatMap,
  groupBy,
  map as mapIx,
  orderBy,
  orderByDescending,
} from 'ix/Ix.iterable.operators';

import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  shareReplay,
  skip,
  startWith,
  switchMap,
} from 'rxjs';

import xlsxInit, {
  Format,
  Table,
  TableColumn,
  TableStyle,
  Workbook,
} from 'wasm-xlsxwriter/web';

//@ts-expect-error
import wasmXlsxWriterPath from 'wasm-xlsxwriter/web/wasm_xlsxwriter_bg.wasm';

import { DataTransferSetDirective } from '../../data-transfer-set.directive';
import { LuxonPipe } from '../../luxon.pipe';
import { AdminRoutingService } from '../admin-routing.service';
import { columns } from '../configs/columns';

import { Bin } from '../types/Bin';
import {
  queryParamByTeamName,
  TeamName,
  teamNameByQueryParam,
  teamNames,
} from '../types/Team';

@Component({
  selector: 'app-right-panel',
  imports: [
    AsyncPipe,
    FormsModule,

    MatAutocompleteModule,
    MatButtonModule,
    MatChipsModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatSlideToggleModule,

    DataTransferSetDirective,
  ],
  templateUrl: './right-panel.component.html',
  styleUrl: './right-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RightPanelComponent {
  readonly teams = teamNames;

  readonly binsNotAssignedToTeam = input.required<Bin[]>();
  readonly binPartCountChanged = input.required();
  readonly tasks =
    input.required<
      (Record<string, any> & { hasAssignee: boolean; newAssignee?: string })[]
    >();

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

  readonly vehicleLinesSet = outputFromObservable(
    toObservable(this.vehicleLines).pipe(
      map(
        (vehicleLines) =>
          new Set(
            from(vehicleLines).pipe(
              mapIx((vehicleLine) => vehicleLine.toLocaleLowerCase())
            )
          )
      )
    )
  );

  readonly currentVehicleLine = model(``);

  readonly vehicleLinesForAutoComplete = combineLatest([
    this.adminRoutingService.getVehicleLines(),
    outputToObservable(this.vehicleLinesSet),
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

  private readonly binSelectionChange = new BehaviorSubject(true);
  readonly binSelectionChangeOutput = outputFromObservable(
    this.binSelectionChange,
    { alias: `binSelectionChange` }
  );

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
  readonly binsOutput = outputFromObservable(
    toObservable(this.bins).pipe(
      map((bins) => ({ bins, binsByName: this.binsByName }))
    ),
    {
      alias: `bins`,
    }
  );

  readonly selectedBinCount = combineLatest([
    toObservable(this.bins),
    toObservable(this.binsNotAssignedToTeam),
    this.binSelectionChange,
  ]).pipe(
    map(([bins, binsNotAssignedToTeam]) => ({
      selected: count(
        concat(bins, binsNotAssignedToTeam).pipe(
          filterIx(({ isSelected }) => isSelected)
        )
      ),
      all: bins.length + binsNotAssignedToTeam.length,
    }))
  );

  readonly maxPartCount = toObservable(this.binPartCountChanged).pipe(
    map(() =>
      first(
        concat(this.bins(), this.binsNotAssignedToTeam()).pipe(
          mapIx((bin) => bin.partCount),
          orderByDescending((partCount) => partCount)
        )
      )
    )
  );

  readonly binsWithPartCountByTeam = toObservable(
    this.binPartCountChanged
  ).pipe(
    map(() =>
      toMap(
        from(this.bins()).pipe(
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

  readonly downloadLink = combineLatest([
    toObservable(this.tasks),
    xlsxInit({ module_or_path: wasmXlsxWriterPath }),
  ]).pipe(
    switchMap(async ([tasks]) => {
      if (tasks.length == 0) return null;

      const dataToExportByAssignee = from(tasks).pipe(
        groupBy(({ hasAssignee, assignee, newAssignee }) =>
          (hasAssignee ? assignee : newAssignee ?? assignee)
            ?.trim()
            ?.toLocaleLowerCase()
        ),
        orderBy(({ key }) => key),
        mapIx((group) => ({
          assignee: group.key,
          rows: toArray(
            group.pipe(
              mapIx((row: any) =>
                toArray(
                  from(columns).pipe(
                    mapIx(({ exportField, field }) => row[exportField ?? field])
                  )
                )
              )
            )
          ),
        }))
      );

      const workbook = new Workbook();
      const table = new Table()
        .setColumns(
          columns.map(({ name }) => new TableColumn().setHeader(name))
        )
        .setStyle(TableStyle.Medium4);

      for (const { assignee, rows } of dataToExportByAssignee) {
        const rowCount = rows.length;

        const worksheet = workbook
          .addWorksheet()
          .setName(assignee)
          .writeRowMatrix(1, 0, rows)
          .addTable(0, 0, rowCount, rows[0].length - 1, table);

        columns.forEach(({ exportColumnWidth, exportNumberFormat }, index) => {
          if (!!exportColumnWidth) {
            worksheet.setColumnWidth(index, exportColumnWidth);
          }

          if (!!exportNumberFormat) {
            worksheet.setRangeWithFormat(
              1,
              index,
              rowCount,
              index,
              new Format().setNumFormat(exportNumberFormat)
            );
          }
        });
      }

      const byteArray = workbook.saveToBufferSync();

      return new Blob([byteArray], {
        type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
      });
    }),
    switchMap((blob) =>
      !blob
        ? of(null)
        : new Observable<{
            url: string;
            name: string;
            dragAndDropDownloadURL: string;
          }>((subscriber) => {
            const url = URL.createObjectURL(blob);

            const name = `Admin routing ${new LuxonPipe().transform(
              new Date(),
              `yyyyMMddHHmmss`
            )}.xlsx`;

            subscriber.next({
              url,
              name,
              dragAndDropDownloadURL: `${blob.type}:${name}:${url}`,
            });

            return () => URL.revokeObjectURL(url);
          })
    )
  );

  private readonly newVehicleLines = new BehaviorSubject(this.vehicleLines());
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

  onBinSelectionChange(isSelected: boolean, bin: Bin) {
    bin.isSelected = isSelected;

    this.binSelectionChange.next(true);
  }
}
