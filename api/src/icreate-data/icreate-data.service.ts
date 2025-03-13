import { Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { finalize, Observable, of, shareReplay, switchMap, tap } from 'rxjs';
import { BigQueryService } from '../big-query/big-query.service';
import { SqlLastModifiedService } from '../sql-last-modified/sql-last-modified.service';
import { ConfigOrConfigs } from '../sql-last-modified/Types/Config';

const dataCache = new WeakMap<
  object,
  { previousLastModified: string | undefined; data: unknown[] | undefined }
>();

const inFlightObservables = new WeakMap<object, Observable<any[]>>();

@Injectable()
export class IcreateDataService {
  constructor(
    private readonly bigQueryService: BigQueryService,
    private readonly sqlLastModifiedService: SqlLastModifiedService
  ) {}

  getData<T>(
    sqlQuery: string,
    lastModifiedConfig: ConfigOrConfigs,
    req: Request,
    res: Response,
    cacheKey?: object
  ) {
    let existingObservable: Observable<T[]> | undefined = !!cacheKey
      ? inFlightObservables.get(cacheKey)
      : undefined;

    if (!existingObservable) {
      existingObservable = this.sqlLastModifiedService
        .getLastModified(lastModifiedConfig, cacheKey)
        .pipe(
          switchMap(lastModified => {
            lastModified = `W/${lastModified}`;

            const { previousLastModified, data } = !!cacheKey
              ? (dataCache.get(cacheKey) ?? {})
              : {};

            const ifNoneMatch = req.headers['if-none-match'];

            const lastModifiedHasValue = !!lastModified;

            if (lastModifiedHasValue) {
              res.set(`Etag`, lastModified!);

              if (!!ifNoneMatch && lastModified == ifNoneMatch) {
                res.status(304);
                return of([]);
              }

              if (lastModified == previousLastModified) {
                return of((data ?? []) as T[]);
              }
            }

            return this.bigQueryService.getQueryResults<T>(sqlQuery).pipe(
              tap(data => {
                if (!!cacheKey) {
                  if (lastModifiedHasValue) {
                    dataCache.set(cacheKey, { data, previousLastModified: lastModified });
                  } else {
                    dataCache.delete(cacheKey);
                  }
                }
              })
            );
          }),
          finalize(() => {
            if (!!cacheKey) {
              inFlightObservables.delete(cacheKey);
            }
          }),
          shareReplay(1)
        );

      if (!!cacheKey) {
        inFlightObservables.set(cacheKey, existingObservable);
      }
    }

    return existingObservable;
  }
}
