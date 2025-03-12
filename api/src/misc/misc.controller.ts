import { Controller, Get, Query } from '@nestjs/common';
import { toArray } from 'rxjs';
import { MiscService } from './misc.service';

@Controller('misc')
export class MiscController {
  constructor(
    private readonly exampleUsingWorkerServiceService: MiscService
  ) {}

  @Get(`fibonacci`)
  fibonacci(@Query(`count`) count?: number) {
    return this.exampleUsingWorkerServiceService.getFibonacciNumbers(count ?? 10).pipe(toArray());
  }
}
