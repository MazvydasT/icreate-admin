import { Observable } from "rxjs";

export function setupContainerSizeObservable(target: Element) {
  return new Observable<DOMRectReadOnly>((subscriber) => {
    const resizeObserver = new ResizeObserver((entries) =>
      subscriber.next(entries[0].contentRect)
    );
    resizeObserver.observe(target);

    return () => resizeObserver.disconnect();
  });
}
