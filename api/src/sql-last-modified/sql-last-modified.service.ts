import { Injectable } from '@nestjs/common';
import { from, toArray } from 'ix/iterable';
import { distinct, flatMap, groupBy, map } from 'ix/iterable/operators';
import { map as mapRx } from 'rxjs/operators';
import { BigQueryService } from '../big-query/big-query.service';
import innerSQLFragment from './SQL/innerFragment.sql';
import outerSQLQuery from './SQL/outerQuery.sql';
import { ConfigOrConfigs } from './Types/Config';

const sqlQueries = new WeakMap<object, string>();

@Injectable()
export class SqlLastModifiedService {
  constructor(private readonly bigQueryService: BigQueryService) {}

  getLastModified(config: ConfigOrConfigs, cacheKey?: object) {
    let sqlQuery = !!cacheKey ? sqlQueries.get(config) : undefined;

    if (!sqlQuery) {
      sqlQuery = outerSQLQuery.replace(
        `@fragments`,
        toArray(
          from(Array.isArray(config) ? config : [config]).pipe(
            groupBy(
              ({ connectionId }) => connectionId,
              ({ tables }) => tables
            ),
            map(group => ({
              connectionId: group.key,
              tableNames: toArray(
                group.pipe(
                  flatMap(tables => tables),
                  distinct(),
                  map(tableName => `'${tableName}'`)
                )
              ).join(`, `)
            })),
            map(({ connectionId, tableNames }) =>
              innerSQLFragment
                .replace(`@connectionId`, connectionId)
                .replace(`@tableNames`, tableNames)
            )
          )
        ).join(`\n\n${`UNION ALL`}\n\n`)
      );

      if (!!cacheKey) sqlQueries.set(cacheKey, sqlQuery);
    }

    return this.bigQueryService
      .getQueryResults<{ max_update_time: { value: string } | null }>(sqlQuery)
      .pipe(mapRx(([{ max_update_time }]) => max_update_time?.value ?? null));
  }

  /*async getLastModified(config: ConfigOrConfigs, cacheKey?: object) {
    let sqlQuery = !!cacheKey ? sqlQueries.get(config) : undefined;

    if (!sqlQuery) {
      sqlQuery = outerSQLQuery.replace(
        `@fragments`,
        toArray(
          from(Array.isArray(config) ? config : [config]).pipe(
            groupBy(
              ({ connectionId }) => connectionId,
              ({ tables }) => tables
            ),
            map(group => ({
              connectionId: group.key,
              tableNames: toArray(
                group.pipe(
                  flatMap(tables => tables),
                  distinct(),
                  map(tableName => `'${tableName}'`)
                )
              ).join(`, `)
            })),
            map(({ connectionId, tableNames }) =>
              innerSQLFragment
                .replace(`@connectionId`, connectionId)
                .replace(`@tableNames`, tableNames)
            )
          )
        ).join(`\n\n${`UNION ALL`}\n\n`)
      );

      if (!!cacheKey) sqlQueries.set(cacheKey, sqlQuery);
    }

    const [{ max_update_time }] = await this.bigQueryService.getQueryResults<{
      max_update_time: { value: string } | null;
    }>(sqlQuery);

    return max_update_time?.value ?? null;
  }*/
}
