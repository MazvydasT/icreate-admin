import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  input,
} from '@angular/core';

type DataTransferSetParam = {
  format: string;
  data: string;
};

@Directive({
  selector: '[dataTransferSet]',
})
export class DataTransferSetDirective {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly dataTransferSetParams = input<
    DataTransferSetParam | DataTransferSetParam[]
  >();

  @HostListener(`dragstart`, [`$event`]) onDragStart(dragEvent: DragEvent) {
    const dataTransfer = dragEvent.dataTransfer;

    if (!dataTransfer) return;

    let params = this.dataTransferSetParams() ?? [
      {
        format: `text/plain`,
        data: this.elementRef.nativeElement.innerText,
      },
    ];

    if (!Array.isArray(params)) params = [params];

    dataTransfer.clearData();

    for (const { format, data } of params) {
      dataTransfer.setData(format, data);
    }
  }
}
