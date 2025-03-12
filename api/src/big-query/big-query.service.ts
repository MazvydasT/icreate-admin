import { BigQuery, BigQueryOptions } from '@google-cloud/bigquery';
import { Injectable } from '@nestjs/common';
import { defer, toArray } from 'rxjs';

@Injectable()
export class BigQueryService {
  getQueryResults<T>(query: string, bigQueryOptions?: BigQueryOptions) {
    return defer(() => new BigQuery(bigQueryOptions).createQueryStream(query)).pipe(toArray<T>());
  }
}
