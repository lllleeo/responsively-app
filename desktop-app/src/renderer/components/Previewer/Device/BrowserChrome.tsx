import {Icon} from '@iconify/react';
import {useEffect, useState} from 'react';
import type {BrowserChromeState} from './useBrowserChrome';
import './browserChrome.css';

import {browserChromeMetrics} from './browserChromeProfiles';
export {browserChromeMetrics} from './browserChromeProfiles';

// Locally drawn solid glyphs: preserve the reference's icon proportions and
// 5px spacing without relying on asynchronously fetched outline icons.
function StatusIcons({height}: {height: number}) {
  return (
    <>
      <svg
        height={height}
        style={{width: height <= 10 ? (height * 33) / 21 : undefined}}
        viewBox="0 0 13 8"
        aria-hidden="true"
      >
        <g fill="currentColor" fillOpacity=".9">
          <rect x="0" y="5" width="2.2" height="3" rx=".5" />
          <rect x="3.4" y="3.5" width="2.2" height="4.5" rx=".5" />
          <rect x="6.8" y="1.8" width="2.2" height="6.2" rx=".5" />
          <rect x="10.2" width="2.2" height="8" rx=".5" />
        </g>
      </svg>
      <svg height={height} viewBox="0 0 12 8" aria-hidden="true">
        <path
          fill="currentColor"
          fillOpacity=".9"
          d="M.2 2.4a8 8 0 0 1 11.6 0l-1.1 1.1a6.5 6.5 0 0 0-9.4 0Zm2 2a5.2 5.2 0 0 1 7.6 0L8.7 5.5a3.7 3.7 0 0 0-5.4 0Zm2 2a2.5 2.5 0 0 1 3.6 0L6 8Z"
        />
      </svg>
      <svg
        height={height}
        style={{width: height <= 10 ? (height * 86) / 39 : undefined}}
        viewBox="0 0 17 8"
        aria-hidden="true"
      >
        <rect
          x=".45"
          y=".45"
          width="14.5"
          height="7.1"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".3"
          strokeWidth=".9"
        />
        <path d="M15.8 2.5a1.6 1.6 0 0 1 0 3Z" fill="currentColor" fillOpacity=".3" />
        <rect
          x="1.3"
          y="1.3"
          width="12.8"
          height="5.4"
          rx="1.1"
          fill="currentColor"
          fillOpacity=".9"
        />
      </svg>
    </>
  );
}

export function browserAddress(url: string) {
  try {
    const parsed = new URL(url);
    return {
      label: parsed.host || (parsed.protocol === 'file:' ? 'Local file' : parsed.protocol),
      secure: parsed.protocol === 'https:',
    };
  } catch {
    return {label: url, secure: false};
  }
}

interface Props {
  chrome: BrowserChromeState;
  metrics: ReturnType<typeof browserChromeMetrics>;
  width: number;
  height: number;
  scale: number;
  offset: number;
}

function AndroidStatusIcons({height}: {height: number}) {
  return (
    <>
      <svg height={height} viewBox="0 0 11 13" aria-hidden="true">
        <path
          d="M1 11v1M4 8v4M7 5v7M10 1v11"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
      <span>100%</span>
      <svg height={height} viewBox="0 0 10 13" aria-hidden="true">
        <path d="M3 0h4v1H3zM2 2h6v10H2z" fill="currentColor" />
      </svg>
    </>
  );
}

// Duo status: open circular arc, rounded Wi-Fi waves, and four signal dots.
// Shape reference: applemagazine.com/wp-content/uploads/2026/09/status-icon-2.jpg
function DuoStatus({time}: {time: Date}) {
  return (
    <div className="device-duo-status" aria-hidden="true">
      <span>
        {time.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false})}
      </span>
      <svg width="42" height="42" viewBox="0 0 42 42">
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <path d="M4.33 30.625a19.25 19.25 0 1 1 33.34 0" strokeWidth="3" />
          <path d="M12.75 18.9Q21 12.3 29.25 18.9M16.2 22.3Q21 18.55 25.8 22.3" strokeWidth="2.6" />
        </g>
        <g fill="currentColor">
          <path d="M18.6 25.6Q21 23.5 23.4 25.6Q23.8 26.1 23.3 26.6L21.8 28.1Q21 28.9 20.2 28.1L18.7 26.6Q18.2 26.1 18.6 25.6Z" />
          <circle cx="11.3" cy="36.3" r="2.1" />
          <circle cx="17.75" cy="38.85" r="2.1" />
          <circle cx="24.25" cy="38.85" r="2.1" />
          <circle cx="30.7" cy="36.3" r="2.1" />
        </g>
      </svg>
    </div>
  );
}

export default function BrowserChrome({chrome, metrics, width, height, scale, offset}: Props) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    if (!metrics.enabled) return undefined;
    const timer = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [metrics.enabled]);
  if (!metrics.enabled) return null;
  const {label, secure} = browserAddress(chrome.url);
  const securityIcon = secure ? 'lucide:lock-keyhole' : 'lucide:globe';
  const glass = metrics.family === 'safari-glass';
  const compactAddress = (
    <button
      className="device-browser-compact"
      type="button"
      aria-label="Expand browser controls"
      onClick={chrome.expand}
      title={chrome.url}
    >
      <Icon icon={securityIcon} width={10} />
      <span>{label}</span>
    </button>
  );
  const back = (
    <button
      type="button"
      aria-label="Go back in preview"
      disabled={!chrome.canGoBack}
      onClick={chrome.back}
    >
      <Icon icon="lucide:chevron-left" width={22} />
    </button>
  );
  const forward = (
    <button
      type="button"
      aria-label="Go forward in preview"
      disabled={!chrome.canGoForward}
      onClick={chrome.forward}
    >
      <Icon icon="lucide:chevron-right" width={22} />
    </button>
  );
  const copy = (
    <button
      type="button"
      aria-label="Copy preview URL"
      onClick={() => navigator.clipboard.writeText(chrome.url).catch(console.error)}
    >
      <Icon icon="lucide:copy" width={21} />
    </button>
  );
  const reload = (
    <button type="button" aria-label="Reload preview page" onClick={chrome.reload}>
      <Icon icon="lucide:rotate-cw" width={21} />
    </button>
  );
  const address = (
    <div className="device-browser-address" title={chrome.url}>
      {metrics.ios && (
        <span className="device-browser-text-size" aria-hidden="true">
          ᴀA
        </span>
      )}
      <span className="device-browser-domain">
        <Icon icon={securityIcon} width={12} />
        <span>{label}</span>
      </span>
      <button type="button" aria-label="Reload preview" onClick={chrome.reload}>
        <Icon icon="lucide:rotate-cw" width={17} />
      </button>
    </div>
  );
  if (metrics.family === 'safari-duo-folded' || metrics.family === 'safari-duo-unfolded') {
    const folded = metrics.family === 'safari-duo-folded';
    return (
      <div
        className="device-browser-chrome"
        data-browser-chrome="safari"
        data-browser-profile={metrics.family}
        data-compact={metrics.compact}
        data-rail-side={metrics.left ? 'left' : 'right'}
        style={{width, height, left: offset, top: offset, transform: `scale(${scale})`}}
      >
        {folded ? (
          <>
            <aside className="device-duo-rail" aria-label="Preview browser sidebar">
              <DuoStatus time={time} />
              <nav className="device-duo-rail-controls" aria-label="Preview browser navigation">
                <div>
                  {back}
                  {forward}
                </div>
                <div>
                  {reload}
                  {copy}
                </div>
              </nav>
            </aside>
            <div
              className="device-browser-bottom device-duo-bottom"
              data-collapsed={metrics.compact}
              style={{height: metrics.bottom, left: metrics.left, right: metrics.right}}
            >
              <div className="device-browser-glass-controls">
                {metrics.compact ? compactAddress : address}
              </div>
            </div>
          </>
        ) : (
          <div className="device-duo-top" style={{height: metrics.top}}>
            <nav className="device-duo-leading" aria-label="Preview history">
              {back}
              {forward}
            </nav>
            {address}
            <div className="device-duo-trailing">
              {copy}
              <DuoStatus time={time} />
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      className="device-browser-chrome"
      data-browser-chrome={metrics.ios ? 'safari' : 'chrome'}
      data-browser-profile={metrics.family}
      data-compact={metrics.compact}
      style={{width, height, left: offset, top: offset, transform: `scale(${scale})`}}
    >
      <div className="device-browser-top" style={{height: metrics.top}}>
        {metrics.status > 0 && (
          <div
            className="device-browser-status"
            style={{
              height: metrics.status,
              fontSize: metrics.statusProfile.fontSize,
              fontWeight: metrics.statusProfile.fontWeight,
              padding: metrics.statusProfile.padding,
            }}
            aria-hidden="true"
          >
            <span
              className="device-browser-status-time"
              style={{width: metrics.statusProfile.sideWidth}}
            >
              {time.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false})}
              {metrics.ios && metrics.tablet && (
                <span className="device-browser-date">
                  {time.toLocaleDateString([], {month: 'short', day: 'numeric'})}
                </span>
              )}
            </span>
            <span
              className="device-browser-status-icons"
              style={{width: metrics.statusProfile.sideWidth}}
            >
              {metrics.ios ? (
                <StatusIcons height={metrics.statusProfile.iconHeight} />
              ) : (
                <AndroidStatusIcons height={metrics.statusProfile.iconHeight} />
              )}
            </span>
          </div>
        )}
        {metrics.topAddress && (
          <div className="device-browser-top-address" style={{height: metrics.addressHeight}}>
            {metrics.compact ? (
              metrics.ios && compactAddress
            ) : (
              <>
                {(metrics.topControls || !metrics.ios) && (
                  <nav className="device-browser-inline-actions" aria-label="Preview history">
                    {back}
                    {metrics.topControls && forward}
                  </nav>
                )}
                {address}
                {(metrics.topControls || !metrics.ios) && (
                  <nav className="device-browser-inline-actions" aria-label="Preview page actions">
                    {copy}
                    {metrics.topControls && reload}
                  </nav>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div
        className="device-browser-bottom"
        data-collapsed={metrics.compact}
        style={{height: metrics.bottom}}
      >
        {metrics.bottom > 0 &&
          (glass ? (
            <div className="device-browser-glass-controls">
              {metrics.compact ? (
                compactAddress
              ) : (
                <>
                  {back}
                  {address}
                  {copy}
                </>
              )}
            </div>
          ) : metrics.compact ? (
            compactAddress
          ) : (
            <>
              {!metrics.topAddress && <div className="device-browser-address-row">{address}</div>}
              <nav className="device-browser-actions" aria-label="Preview browser navigation">
                {back}
                {forward}
                {copy}
                {reload}
              </nav>
            </>
          ))}
      </div>
      {metrics.home > 0 && (
        <div className="device-browser-home" aria-hidden="true">
          <span />
        </div>
      )}
    </div>
  );
}
