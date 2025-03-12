import { Pipe, PipeTransform } from '@angular/core';
import { DateTime } from 'luxon';

@Pipe({
  name: 'luxon',
})
export class LuxonPipe implements PipeTransform {
  transform(
    value: string | number | Date,
    format?: string | Intl.DateTimeFormatOptions,
    locale?: string
  ) {
    const dateTime = (() => {
      switch (typeof value) {
        case 'string':
          return DateTime.fromISO(value);

        case 'number':
          return DateTime.fromMillis(value);

        default:
          return DateTime.fromJSDate(value);
      }
    })();

    const localeOptionsToUse = { locale };

    format = format ?? `DATETIME_MED`;

    switch (typeof format) {
      case 'string': {
        const getterFunction = Object.getOwnPropertyDescriptor(
          DateTime,
          format
        )?.get;
        const dateTimeFormatOptions = !!getterFunction
          ? getterFunction()
          : undefined;

        if (!!dateTimeFormatOptions)
          return dateTime.toLocaleString(
            dateTimeFormatOptions,
            localeOptionsToUse
          );

        return dateTime.toFormat(format, localeOptionsToUse);
      }

      default:
        return dateTime.toLocaleString(format, localeOptionsToUse);
    }
  }
}
