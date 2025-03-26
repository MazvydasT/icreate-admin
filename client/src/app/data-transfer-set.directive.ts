import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  input,
} from '@angular/core';

@Directive({
  selector: '[dataTransferSet]',
})
export class DataTransferSetDirective {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly params = input<{ format: string; data: string }>();

  @HostListener(`dragstart`, [`$event`]) onDragStart(dragEvent: DragEvent) {
    let { format, data } = this.params() ?? {};

    if (!format || !data) {
      format = `text/plain`;

      data = this.elementRef.nativeElement.innerText;
    }

    dragEvent.dataTransfer?.setData(format, data);
  }
}
