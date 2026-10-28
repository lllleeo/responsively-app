import {Icon} from '@iconify/react';
import cx from 'classnames';
import {Device as IDevice, getIPhone18Variant, getIPhoneDuoVariant} from 'common/deviceList';
import {ReactNode} from 'react';
import Spinner from 'renderer/components/Spinner';
import {
  overlayModeOf,
  type DesignOverlayState,
  type ViewResolution,
} from '../../../store/features/design-overlay';
import {Coordinates} from '../../../store/features/ruler';
import GuideGrid, {DefaultGuide} from '../Guides';
import ScaledFrame from '../ScaledFrame';
import DesignOverlay from './DesignOverlay';
import {frameImageStyle, getDeviceFrame, layoutFrame} from './frames';
import type {NavigationState} from './navigationMachine';
import BrowserChrome, {browserChromeMetrics} from './BrowserChrome';
import type {BrowserChromeState} from './useBrowserChrome';

const RULER_GUTTER = 30;

/**
 * Generic bezel geometry per form factor (Hybrid Studio canvas design) — the
 * fallback for devices without real frame artwork.
 */
const BEZELS: Record<string, {pad: string; radius: string; screenRadius: number}> = {
  phone: {pad: '16px 7px', radius: '26px', screenRadius: 9},
  tablet: {pad: '14px 12px', radius: '18px', screenRadius: 4},
  notebook: {pad: '10px 10px', radius: '12px 12px 3px 3px', screenRadius: 4},
};

interface Props {
  device: IDevice;
  width: number;
  height: number;
  zoomfactor: number;
  rulerActive: boolean;
  navigation: NavigationState;
  browserChrome: BrowserChromeState;
  screenshotInProgress: boolean;
  coordinates: Coordinates;
  darkMode: boolean;
  defaultGuides: DefaultGuide[];
  designOverlay: DesignOverlayState | undefined;
  resolution: ViewResolution;
  isRestrictedMinimumDeviceSize: boolean;
  /** Canvas view options: device frame + label visibility. */
  showBezel: boolean;
  showName: boolean;
  showDims: boolean;
  isRotated: boolean;
  /** Active vision simulation, shown as a badge next to the label. */
  simulationName: string | undefined;
  /** Brief capture feedback overlay. */
  flashing: boolean;
  initialSrc: string;
  /** Callback ref — never a ref object (see Device for why). */
  webviewRef: (element: Electron.WebviewTag | null) => void;
  toolbar: ReactNode;
}

/**
 * Presentational shell of one preview: header, toolbar, the scaled webview
 * frame with guides, and the loading/error/screenshot overlays. All behavior
 * lives in the Device orchestrator and its hooks.
 */
const DeviceFrame = ({
  device,
  width,
  height,
  zoomfactor,
  rulerActive,
  navigation,
  browserChrome,
  screenshotInProgress,
  coordinates,
  darkMode,
  defaultGuides,
  designOverlay,
  resolution,
  isRestrictedMinimumDeviceSize,
  showBezel,
  showName,
  showDims,
  isRotated,
  simulationName,
  flashing,
  initialSrc,
  webviewRef,
  toolbar,
}: Props) => {
  const scaledHeight = height * zoomfactor;
  const scaledWidth = width * zoomfactor;
  const rulerOffset = rulerActive ? RULER_GUTTER : 0;
  // Real hardware artwork when the device has some; the generic CSS bezel
  // otherwise (custom devices, models with no redistributable frame).
  const artwork = showBezel ? getDeviceFrame(device) : null;
  const frame = artwork === null ? null : layoutFrame(artwork, scaledWidth, scaledHeight);
  // Thin hardware bezels may not leave room for the ruler gutter. Reserve
  // that room outside the artwork so rulers never cover the device label.
  const frameInsetX = frame === null ? 0 : Math.max(0, rulerOffset - frame.screenLeft);
  const frameInsetY = frame === null ? 0 : Math.max(0, rulerOffset - frame.screenTop);
  const duo = getIPhoneDuoVariant(device);
  const duoFolded = duo === 'folded';
  // Original CSS frame, using the reference preset's screen offsets/corners.
  // No extension artwork is bundled. Rotation keeps the hinge and camera on
  // the same physical edge as the reference's landscape cut-out.
  const duoBezel = duo
    ? {
        pad: duoFolded
          ? isRotated
            ? `${20 * zoomfactor}px ${20 * zoomfactor}px ${27 * zoomfactor}px ${20 * zoomfactor}px`
            : `${20 * zoomfactor}px ${20 * zoomfactor}px ${20 * zoomfactor}px ${27 * zoomfactor}px`
          : isRotated
            ? `${19 * zoomfactor}px ${23 * zoomfactor}px`
            : `${23 * zoomfactor}px ${19 * zoomfactor}px`,
        radius: duoFolded
          ? isRotated
            ? `${78 * zoomfactor}px ${78 * zoomfactor}px ${20 * zoomfactor}px ${20 * zoomfactor}px`
            : `${20 * zoomfactor}px ${78 * zoomfactor}px ${78 * zoomfactor}px ${20 * zoomfactor}px`
          : `${70 * zoomfactor}px`,
        screenRadius: duoFolded ? 7.7 * zoomfactor : 50 * zoomfactor,
      }
    : null;
  const iphone18 = getIPhone18Variant(device);
  // Original CSS geometry based on the reference's viewport and island bounds.
  const iphone18Geometry = iphone18
    ? iphone18 === 'pro'
      ? {
          insetX: 19,
          insetY: 15,
          radius: 76.7,
          island: {x: 139.005, y: 14.456, width: 123.713, height: 35.588},
        }
      : {
          insetX: 21,
          insetY: 17,
          radius: 84,
          island: {x: 152.146, y: 15.832, width: 135.409, height: 38.971},
        }
    : null;
  const iphone18Bezel = iphone18Geometry
    ? {
        pad: isRotated
          ? `${iphone18Geometry.insetX * zoomfactor}px ${iphone18Geometry.insetY * zoomfactor}px`
          : `${iphone18Geometry.insetY * zoomfactor}px ${iphone18Geometry.insetX * zoomfactor}px`,
        radius: `${(iphone18Geometry.radius + iphone18Geometry.insetY) * zoomfactor}px`,
        screenRadius: iphone18Geometry.radius * zoomfactor,
      }
    : null;
  const island = iphone18Geometry?.island;
  const bezel =
    showBezel && frame === null
      ? (duoBezel ?? iphone18Bezel ?? BEZELS[device.type] ?? BEZELS.notebook)
      : null;
  const screenRadius =
    duoFolded && bezel
      ? isRotated
        ? `${58.1 * zoomfactor}px ${58.1 * zoomfactor}px ${7.7 * zoomfactor}px ${7.7 * zoomfactor}px`
        : `${7.7 * zoomfactor}px ${58.1 * zoomfactor}px ${58.1 * zoomfactor}px ${7.7 * zoomfactor}px`
      : (frame?.screenRadius ?? bezel?.screenRadius);
  const isLaptop = device.type === 'notebook';
  const chromeMetrics = browserChromeMetrics(device, isRotated, browserChrome.collapsed);
  const viewportWidth = Math.max(1, width - chromeMetrics.left - chromeMetrics.right);
  const viewportLeft = chromeMetrics.left * zoomfactor;
  const scaledViewportWidth = viewportWidth * zoomfactor;
  const viewportHeight = Math.max(1, height - chromeMetrics.top - chromeMetrics.bottom);
  const viewportTop = chromeMetrics.top * zoomfactor;
  const scaledViewportHeight = viewportHeight * zoomfactor;

  // Keep this screen in the same parent and child slot for every frame mode.
  // Reparenting a webview destroys its guest, including page state and listeners.
  const screen = (
    <ScaledFrame
      width={width}
      height={height}
      scale={zoomfactor}
      offset={rulerOffset}
      // Under real artwork the selection ring must sit inside the cut-out or
      // the bezel hides it.
      className={cx('bg-white', {'ring-inset': frame !== null})}
      // A transformed webview's unscaled box overflows this shell. Unlike
      // hidden, clip prevents focus/rotation from scrolling the shell itself
      // and shifting the status bar and footer out of the hardware cut-out.
      style={{
        overflow: 'clip',
        ...(screenRadius !== undefined && !rulerActive ? {borderRadius: screenRadius} : {}),
      }}
    >
      <GuideGrid
        scaledHeight={scaledHeight}
        scaledWidth={scaledWidth}
        height={height}
        width={width}
        coordinates={coordinates}
        zoomFactor={zoomfactor}
        night={darkMode}
        enabled={rulerActive}
        defaultGuides={defaultGuides}
        zIndex={frame !== null ? 3 : 1}
      />
      <div className="bg-white">
        <webview
          id={device.name}
          src={initialSrc}
          style={{
            height: viewportHeight,
            width: viewportWidth,
            display: 'inline-flex',
            transform: `scale(${zoomfactor})`,
            marginLeft: rulerOffset + viewportLeft,
            marginTop: rulerOffset + viewportTop,
          }}
          ref={webviewRef}
          className="device-browser-viewport origin-top-left"
          /* eslint-disable-next-line react/no-unknown-property */
          preload={`file://${window.responsively.webviewPreloadPath}`}
          data-scale-factor={zoomfactor}
          /* React drops boolean-valued unknown attributes entirely, so this
             must be a string for the attribute to reach the DOM at all.
             (@types/react declares it boolean, which react-dom never renders.) */
          /* eslint-disable-next-line react/no-unknown-property */
          allowpopups={'true' as unknown as boolean}
          /* eslint-disable-next-line react/no-unknown-property */
          useragent={device.userAgent}
        />
      </div>
      {duoFolded && showBezel && !rulerActive && (
        <div
          data-duo-camera=""
          className="pointer-events-none absolute z-2 rounded-full"
          style={{
            width: 35.5 * zoomfactor,
            height: 35.5 * zoomfactor,
            left: (isRotated ? 30 : 400.5) * zoomfactor,
            top: 30 * zoomfactor,
            background:
              'radial-gradient(circle at 50% 50%, #203346 0 12%, #0a1019 18% 30%, #000 36%)',
          }}
        />
      )}
      {island && showBezel && !rulerActive && (
        <div
          data-device-island=""
          className="pointer-events-none absolute z-2 rounded-full bg-black"
          style={{
            width: (isRotated ? island.height : island.width) * zoomfactor,
            height: (isRotated ? island.width : island.height) * zoomfactor,
            left: (isRotated ? island.y : island.x) * zoomfactor,
            top: (isRotated ? device.width - island.x - island.width : island.y) * zoomfactor,
          }}
        />
      )}
      <BrowserChrome
        chrome={browserChrome}
        metrics={chromeMetrics}
        width={width}
        height={height}
        scale={zoomfactor}
        offset={rulerOffset}
      />

      {designOverlay?.enabled && overlayModeOf(designOverlay) === 'grid' ? (
        <div
          data-testid="grid-overlay"
          className="pointer-events-none absolute z-2"
          style={{
            left: rulerOffset + viewportLeft,
            top: rulerOffset + viewportTop,
            width: scaledViewportWidth,
            height: scaledViewportHeight,
            opacity: designOverlay.opacity / 100,
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(236,72,153,.45) 0 56px, transparent 56px 84px)',
            boxShadow: 'inset 0 0 0 1px rgba(236,72,153,.35)',
          }}
        />
      ) : null}
      {designOverlay?.enabled &&
        overlayModeOf(designOverlay) === 'image' &&
        designOverlay.image &&
        designOverlay.position === 'overlay' && (
          <div style={{position: 'absolute', top: viewportTop, left: viewportLeft}}>
            <DesignOverlay
              resolution={resolution}
              scaledWidth={scaledViewportWidth}
              scaledHeight={scaledViewportHeight}
              zoomFactor={zoomfactor}
              coordinates={coordinates}
              position={designOverlay.position}
              rulerMargin={rulerOffset}
              width={viewportWidth}
              height={viewportHeight}
            />
          </div>
        )}

      {screenshotInProgress ? (
        <div
          className="absolute top-0 left-0 flex h-full w-full items-center justify-center bg-slate-600/95"
          style={{height: scaledHeight, width: scaledWidth}}
        >
          <Spinner spinnerHeight={30} />
        </div>
      ) : null}
      {flashing ? (
        <div
          data-testid="capture-flash"
          className="absolute top-0 left-0 z-10 flex items-center justify-center bg-(--flash)"
          style={{height: scaledHeight, width: scaledWidth}}
        >
          <Icon icon="lucide:camera" fontSize={26} className="text-[#333]" />
        </div>
      ) : null}
      {navigation.error != null ? (
        <div
          className="absolute top-0 left-0 flex h-full w-full items-center justify-center bg-slate-600/95"
          style={{height: scaledHeight, width: scaledWidth}}
        >
          <div className="text-center text-sm text-white">
            <div className="text-base font-bold">ERROR: {navigation.error.code}</div>
            <div className="text-sm">{navigation.error.description}</div>
          </div>
        </div>
      ) : null}
    </ScaledFrame>
  );

  return (
    <div
      className={cx('group relative h-fit', {
        'min-w-52': isRestrictedMinimumDeviceSize,
      })}
    >
      {/* The label row is also the canvas drag handle, so it stays in the
          tree even when name and dims are toggled off. */}
      <div
        className="flex min-h-[20px] items-baseline gap-2 pb-[2px]"
        data-device-label={device.name}
      >
        {showName ? <span className="text-[13px] font-bold">{device.name}</span> : null}
        {showDims ? (
          <span className="font-mono text-[11px] text-muted">
            {width} × {height}
          </span>
        ) : null}
        {simulationName !== undefined ? (
          <span
            data-testid="sim-badge"
            className="rounded-full bg-accent-soft px-2 py-[2px] text-[10.5px] text-accent capitalize"
          >
            {simulationName}
          </span>
        ) : null}
        <span className="flex-1" />
        {navigation.loading ? <Spinner spinnerHeight={20} /> : null}
      </div>
      {toolbar}
      <div className="flex gap-4">
        <div
          data-bezel={showBezel || undefined}
          data-device-frame={
            artwork?.id ??
            (showBezel && duo
              ? `iphone-duo-${duo}`
              : showBezel && iphone18
                ? `iphone-18-${iphone18}`
                : undefined)
          }
          className="relative shrink-0"
          style={
            frame !== null
              ? {width: frame.width + frameInsetX, height: frame.height + frameInsetY}
              : bezel !== null
                ? {
                    padding: bezel.pad,
                    borderRadius: bezel.radius,
                    background: 'linear-gradient(145deg,#3a3d45,#1b1d22)',
                    boxShadow: '0 10px 30px rgba(0,0,0,.35)',
                    width: 'fit-content',
                  }
                : undefined
          }
        >
          {/* Only the positioning changes: the webview always keeps its parent.
              Keep this wrapper out of a stacking context so the ruler layer
              can appear above the artwork while the page remains below it. */}
          <div
            style={
              frame !== null
                ? {
                    position: 'absolute',
                    left: frame.screenLeft + frameInsetX - rulerOffset,
                    top: frame.screenTop + frameInsetY - rulerOffset,
                  }
                : undefined
            }
          >
            {screen}
          </div>
          {frame !== null ? (
            <img
              src={frame.src}
              alt=""
              draggable={false}
              className="pointer-events-none select-none"
              style={{
                ...frameImageStyle(frame),
                left: (frame.width - frame.imageWidth) / 2 + frameInsetX,
                top: (frame.height - frame.imageHeight) / 2 + frameInsetY,
                zIndex: 2,
              }}
            />
          ) : null}
          {bezel !== null && !duo && !iphone18 && !isLaptop && !isRotated ? (
            <div className="absolute top-[6px] left-1/2 h-1 w-[34px] -translate-x-1/2 rounded-full bg-[#4a4d55]" />
          ) : null}
          {bezel !== null && isLaptop ? (
            <div
              className="absolute bottom-[-9px] left-1/2 h-3 -translate-x-1/2 rounded-[2px_2px_12px_12px] shadow-[0_8px_16px_rgba(0,0,0,.3)]"
              style={{
                width: scaledWidth + 20 + 36,
                background: 'linear-gradient(180deg,#4a4d55,#26282e)',
              }}
            />
          ) : null}
        </div>

        {designOverlay?.enabled &&
          overlayModeOf(designOverlay) === 'image' &&
          designOverlay.image &&
          designOverlay.position === 'side' && (
            <div
              style={{
                paddingTop:
                  viewportTop + (frame === null ? 0 : frame.screenTop + frameInsetY - rulerOffset),
              }}
            >
              <DesignOverlay
                resolution={resolution}
                scaledWidth={scaledViewportWidth}
                scaledHeight={scaledViewportHeight}
                zoomFactor={zoomfactor}
                coordinates={coordinates}
                position={designOverlay.position}
                rulerMargin={rulerOffset}
                width={viewportWidth}
                height={viewportHeight}
              />
            </div>
          )}
      </div>
    </div>
  );
};

export default DeviceFrame;
