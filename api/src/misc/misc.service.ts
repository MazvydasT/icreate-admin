import { Injectable } from '@nestjs/common';
import { WorkerService } from '../worker/worker.service';
import fibonacciWorkerPath from './fibonacci.worker.wts';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

@Injectable()
export class MiscService {
  constructor(private readonly workerService: WorkerService) {}

  getFibonacciNumbers(count?: number) {
    return this.workerService.run<BigInt>(fibonacciWorkerPath, count);
  }
}
