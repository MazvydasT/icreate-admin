import { Injectable } from '@nestjs/common';
import { resolve } from 'path';
import { Observable } from 'rxjs';
import { TransferListItem, Worker } from 'worker_threads';

@Injectable()
export class WorkerService {
  run<T>(pathToWorker: string, workerData: any, transferList?: readonly TransferListItem[]) {
    return new Observable<T>(subscriber => {
      const worker = new Worker(resolve(__dirname, pathToWorker));

      worker
        .on(`message`, (data: T) => subscriber.next(data))
        .on(`error`, error => subscriber.error(error))
        .on(`messageerror`, error => subscriber.error(error))
        .on(`exit`, () => subscriber.complete());

      worker.postMessage(workerData, transferList);

      return () => worker.terminate();
    });
  }
}
