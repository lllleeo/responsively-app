import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {observeBrowserChromeScroll} from './browser-chrome-scroll';

describe('browser chrome scroll observation', () => {
  let target: HTMLDivElement;
  let viewport: number;
  let stop: () => void;
  let flush: FrameRequestCallback | undefined;
  const send = vi.fn();
  const emit = (y: number) => {
    target.scrollTop = y;
    target.dispatchEvent(new Event('scroll'));
  };
  const tick = () => {
    const callback = flush;
    flush = undefined;
    callback?.(0);
  };
  beforeEach(() => {
    viewport = 600;
    target = document.createElement('div');
    document.body.append(target);
    Object.defineProperties(target, {
      clientHeight: {get: () => viewport},
      scrollHeight: {value: 1600},
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      flush = callback;
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      flush = undefined;
    });
    send.mockClear();
    stop = observeBrowserChromeScroll(send);
  });
  afterEach(() => {
    stop();
    target.remove();
    vi.restoreAllMocks();
  });

  it('coalesces nested scrolling into one message per frame', () => {
    emit(40);
    emit(80);
    expect(send).not.toHaveBeenCalled();
    tick();
    expect(send).toHaveBeenCalledExactlyOnceWith({y: 80, deltaY: 80});
  });

  it('preserves an upward scroll queued before a viewport resize event', () => {
    emit(400);
    tick();
    send.mockClear();
    viewport = 635;
    target.scrollTop = 0;
    window.dispatchEvent(new Event('resize'));
    target.dispatchEvent(new Event('scroll'));
    tick();
    expect(send).toHaveBeenCalledExactlyOnceWith({y: 0, deltaY: -400});
  });

  it('ignores bottom clamping after expansion but keeps the next real upward scroll', () => {
    emit(1000);
    tick();
    send.mockClear();
    viewport = 635;
    emit(965);
    tick();
    expect(send).not.toHaveBeenCalled();
    emit(900);
    tick();
    expect(send).toHaveBeenCalledExactlyOnceWith({y: 900, deltaY: -65});
  });

  it('ignores unchanged scroll positions', () => {
    emit(0);
    tick();
    expect(send).not.toHaveBeenCalled();
  });

  it('ignores bottom anchoring when controls expand and shrink the viewport', () => {
    emit(1000);
    tick();
    send.mockClear();
    viewport = 565;
    emit(1035);
    tick();
    expect(send).not.toHaveBeenCalled();
    emit(900);
    tick();
    expect(send).toHaveBeenCalledExactlyOnceWith({y: 900, deltaY: -135});
  });

  it('removes the listener and cancels pending work on cleanup', () => {
    emit(400);
    stop();
    tick();
    emit(500);
    tick();
    expect(send).not.toHaveBeenCalled();
  });
});
