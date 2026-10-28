import {act, cleanup, renderHook} from '@testing-library/react';
import useBrowserChrome from './useBrowserChrome';
import {browserAddress, browserChromeMetrics} from './BrowserChrome';
import {defaultDevices} from 'common/deviceList';

afterEach(cleanup);

function setup() {
  const guest = Object.assign(new EventTarget(), {
    getURL: vi.fn(() => 'https://example.com/redirected'),
    canGoBack: vi.fn(() => true),
    canGoForward: vi.fn(() => false),
    goBack: vi.fn(),
    goForward: vi.fn(),
    reload: vi.fn(),
  });
  const ref = {current: guest as unknown as Electron.WebviewTag};
  const hook = renderHook(() => useBrowserChrome(ref, 'https://example.com/'));
  const emit = (type: string, data = {}) =>
    act(() => {
      guest.dispatchEvent(Object.assign(new Event(type), data));
    });
  const scroll = (y: number, deltaY: number) =>
    emit('ipc-message', {
      channel: 'browser-chrome-scroll',
      args: [{y, deltaY}],
    });
  return {guest, ...hook, emit, scroll};
}

describe('preview browser chrome', () => {
  it('collapses after real downward travel, expands upward and at the top', () => {
    const {result, scroll} = setup();
    scroll(8, 8);
    expect(result.current.collapsed).toBe(false);
    scroll(20, 12);
    expect(result.current.collapsed).toBe(true);
    scroll(18, -2);
    expect(result.current.collapsed).toBe(true);
    scroll(3, -15);
    expect(result.current.collapsed).toBe(false);
    scroll(100, 97);
    expect(result.current.collapsed).toBe(true);
    scroll(0, -100);
    expect(result.current.collapsed).toBe(false);
  });

  it('ignores wheel intent and malformed messages; manual expansion resets travel', () => {
    const {result, emit, scroll} = setup();
    emit('ipc-message', {channel: 'pass-scroll-data', args: [{coordinates: {y: 300}}]});
    emit('ipc-message', {channel: 'browser-chrome-scroll', args: [{y: NaN, deltaY: 50}]});
    expect(result.current.collapsed).toBe(false);
    scroll(40, 40);
    act(() => result.current.expand());
    scroll(41, 1);
    expect(result.current.collapsed).toBe(false);
  });

  it('tracks the guest URL/history and resets on main-frame navigation only', () => {
    const {result, guest, emit, scroll} = setup();
    emit('dom-ready');
    expect(result.current.url).toBe('https://example.com/redirected');
    expect(result.current.canGoBack).toBe(true);
    expect(result.current.canGoForward).toBe(false);
    act(() => {
      result.current.back();
      result.current.forward();
      result.current.reload();
    });
    expect(guest.goBack).toHaveBeenCalledOnce();
    expect(guest.goForward).not.toHaveBeenCalled();
    expect(guest.reload).toHaveBeenCalledOnce();
    scroll(200, 200);
    emit('did-navigate-in-page', {isMainFrame: false});
    expect(result.current.collapsed).toBe(true);
    emit('did-navigate', {url: 'https://example.com/redirected'});
    expect(result.current.collapsed).toBe(false);
  });

  it('removes all guest listeners when a device unmounts', () => {
    const {guest, unmount, emit} = setup();
    unmount();
    emit('dom-ready');
    expect(guest.getURL).not.toHaveBeenCalled();
  });

  it('reserves browser space on mobile in both orientations, but leaves desktop unchanged', () => {
    const phone = defaultDevices.find((d) => d.name === 'iPhone 15')!;
    const desktop = defaultDevices.find((d) => !d.isMobileCapable)!;
    for (const rotated of [true, false]) {
      const expanded = browserChromeMetrics(phone, rotated, false);
      const collapsed = browserChromeMetrics(phone, rotated, true);
      expect(expanded.top).toBeGreaterThan(0);
      expect(expanded.bottom).toBeGreaterThan(collapsed.bottom);
      expect(expanded.top).toBe(collapsed.top);
      expect(browserChromeMetrics(desktop, rotated, false)).toMatchObject({top: 0, bottom: 0});
    }
  });

  it('only displays a lock for HTTPS and never exposes URL credentials in the label', () => {
    expect(browserAddress('https://user:password@example.com/private')).toEqual({
      label: 'example.com',
      secure: true,
    });
    expect(browserAddress('http://localhost:3000')).toEqual({
      label: 'localhost:3000',
      secure: false,
    });
    expect(browserAddress('file:///tmp/test.html')).toEqual({label: 'Local file', secure: false});
  });

  it('uses the observed simulator status profiles instead of a single tall-phone height', () => {
    const metrics = (name: string) =>
      browserChromeMetrics(
        defaultDevices.find((d) => d.name === name)!,
        false,
        false
      );
    expect(metrics('iPhone 12 Pro')).toMatchObject({
      status: 35,
      statusProfile: {fontSize: 14, sideWidth: '27%', iconHeight: 10},
    });
    expect(metrics('iPhone 13 Pro Max').status).toBeCloseTo(926 * 0.051);
    expect(metrics('iPhone 14 Pro Max')).toMatchObject({
      statusProfile: {fontSize: 16, sideWidth: '36%', iconHeight: 12},
    });
    expect(metrics('iPhone 14 Pro Max').status).toBeCloseTo(932 * 0.07);
    expect(metrics('iPhone 5/SE').status).toBe(25);
    expect(metrics('iPad').status).toBe(25);
  });
  it.each([
    ['iPhone 5/SE', 72, 44, 45, 0],
    ['iPhone 12 Pro', 86, 83, 59, 0],
    ['iPhone 13 Pro Max', 926 * 0.051, 128, 926 * 0.051, 48],
    ['iPhone 15', 852 * 0.066, 90, 852 * 0.066, 55],
    ['iPhone 17 Air', 926 * 0.084, 90, 926 * 0.084, 55],
    ['iPad', 76, 0, 76, 0],
    ['Galaxy S20', 85, 0, 32, 0],
    ['Pixel 5', 95, 0, 42, 0],
    ['Pixel 10', 107, 0, 54, 0],
    ['Galaxy Tab S9', 85, 0, 32, 0],
  ])(
    'matches %s header/footer geometry and collapse targets',
    (name, top, bottom, compactTop, compactBottom) => {
      const device = defaultDevices.find((d) => d.name === name)!;
      const expanded = browserChromeMetrics(device, false, false);
      const collapsed = browserChromeMetrics(device, false, true);
      expect(expanded.top).toBeCloseTo(top as number);
      expect(expanded.bottom).toBe(bottom);
      expect(collapsed.top).toBeCloseTo(compactTop as number);
      expect(collapsed.bottom).toBe(compactBottom);
    }
  );

  it('moves Safari navigation to the top in landscape and keeps tablets stable', () => {
    for (const name of ['iPhone 12 Pro', 'iPhone 14 Pro Max']) {
      const device = defaultDevices.find((d) => d.name === name)!;
      expect(browserChromeMetrics(device, true, false)).toMatchObject({
        status: 0,
        top: 51,
        bottom: 0,
        topControls: true,
      });
      expect(browserChromeMetrics(device, true, true)).toMatchObject({top: 24, bottom: 0});
    }
    for (const name of ['iPad Mini', 'iPad Pro M4']) {
      const device = defaultDevices.find((d) => d.name === name)!;
      for (const rotated of [true, false]) {
        expect(browserChromeMetrics(device, rotated, false)).toEqual(
          browserChromeMetrics(device, rotated, true)
        );
      }
    }
  });

  it('uses Android glyph geometry and camera clearance; does not misidentify Windows Phone compatibility UAs', () => {
    const device = defaultDevices.find((d) => d.name === 'Pixel 5')!;
    const duo = defaultDevices.find((d) => d.name === 'Surface Duo')!;
    expect(browserChromeMetrics(duo, false, false)).toMatchObject({
      tablet: true,
      bottom: 0,
      statusProfile: {padding: '0 15px'},
    });
    expect(browserChromeMetrics(device, false, false).statusProfile).toMatchObject({
      fontWeight: 400,
      iconHeight: 13,
      padding: '17px 23px 0 51px',
    });
    for (const d of defaultDevices.filter((d) => /Lumia/.test(d.name))) {
      expect(browserChromeMetrics(d, false, false).ios).toBe(false);
    }
    expect(
      browserChromeMetrics({...device, name: 'OnePlus Nord 2'}, false, false).statusProfile.padding
    ).toBe('13px 23px 0 65px');
  });

  it('honors custom iOS versions and keeps every built-in viewport positive in both orientations', () => {
    const phone = defaultDevices.find((d) => d.name === 'iPhone 15')!;
    expect(browserChromeMetrics({...phone, isCustom: true}, false, false).family).toBe(
      'safari-modern'
    );
    expect(
      browserChromeMetrics(
        {...phone, isCustom: true, userAgent: phone.userAgent.replace(/OS \d+_\d+/, 'OS 26_0')},
        false,
        false
      ).family
    ).toBe('safari-glass');
    for (const device of defaultDevices) {
      for (const rotated of [false, true]) {
        for (const collapsed of [false, true]) {
          const {top, bottom} = browserChromeMetrics(device, rotated, collapsed);
          expect(top).toBeGreaterThanOrEqual(0);
          expect(bottom).toBeGreaterThanOrEqual(0);
          expect(top + bottom).toBeLessThan(rotated ? device.width : device.height);
        }
      }
    }
  });
});

describe('iPhone Duo reference presets', () => {
  const folded = defaultDevices.find((d) => d.name === 'iPhone Duo (Folded)')!;
  const unfolded = defaultDevices.find((d) => d.name === 'iPhone Duo (Unfolded)')!;

  it('registers both reference viewports and preserves their different Safari UAs', () => {
    expect(folded).toMatchObject({
      width: 466,
      height: 678,
      dpr: 3,
      isMobileCapable: true,
      isTouchCapable: true,
    });
    expect(unfolded).toMatchObject({
      width: 890,
      height: 626,
      dpr: 3,
      isMobileCapable: true,
      isTouchCapable: true,
    });
    expect(folded.userAgent).toContain('iPhone OS 27_0');
    expect(unfolded.userAgent).toContain('Macintosh');
    expect(new Set(defaultDevices.map((d) => d.id)).size).toBe(defaultDevices.length);
  });

  it('reserves a side rail and URL-only footer, moving the rail after rotation', () => {
    expect(browserChromeMetrics(folded, false, false)).toMatchObject({
      family: 'safari-duo-folded',
      top: 0,
      bottom: 90,
      left: 0,
      right: 84,
    });
    expect(browserChromeMetrics(folded, false, true)).toMatchObject({
      bottom: 55,
      left: 0,
      right: 84,
    });
    expect(browserChromeMetrics(folded, true, false)).toMatchObject({
      top: 0,
      bottom: 90,
      left: 84,
      right: 0,
    });
    expect(browserChromeMetrics(folded, true, true)).toMatchObject({
      bottom: 55,
      left: 84,
      right: 0,
    });
  });

  it('keeps the unfolded top row stable in both orientations with no bottom toolbar', () => {
    for (const rotated of [false, true]) {
      expect(browserChromeMetrics(unfolded, rotated, false)).toMatchObject({
        family: 'safari-duo-unfolded',
        ios: true,
        top: 77,
        bottom: 0,
        left: 0,
        right: 0,
      });
      expect(browserChromeMetrics(unfolded, rotated, true)).toEqual(
        browserChromeMetrics(unfolded, rotated, false)
      );
    }
    // Imported custom devices with colliding IDs must not acquire a Duo rail.
    expect(browserChromeMetrics({...folded, isCustom: true}, false, false).family).toBe(
      'safari-glass'
    );
  });
});

describe('iPhone 18 extension presets', () => {
  it.each([
    ['iPhone 18 Pro', 402, 873],
    ['iPhone 18 Pro Max', 440, 956],
  ])('uses the reference dimensions and Safari layout for %s', (name, width, height) => {
    const device = defaultDevices.find((d) => d.name === name)!;
    expect(device).toMatchObject({
      width,
      height,
      dpr: 3,
      isMobileCapable: true,
      isTouchCapable: true,
    });
    expect(device.userAgent).toContain('iPhone OS 26_0');
    const portrait = browserChromeMetrics(device, false, false);
    expect(portrait).toMatchObject({family: 'safari-glass', bottom: 90, left: 0, right: 0});
    expect(portrait.top).toBeCloseTo((height as number) * 0.075);
    expect(browserChromeMetrics(device, false, true).bottom).toBe(55);
    const landscape = browserChromeMetrics(device, true, false);
    expect(landscape.left).toBeCloseTo((height as number) * 0.06);
    expect(landscape.right).toBe(landscape.left);
    expect(browserChromeMetrics({...device, isCustom: true}, true, false).left).toBe(0);
  });
});
