import {RefObject, useCallback, useEffect, useRef, useState} from 'react';

/** Local guest state: secondary devices can have their own redirects and history. */
export default function useBrowserChrome(
  ref: RefObject<Electron.WebviewTag | null>,
  initialUrl: string
) {
  const [url, setUrl] = useState(initialUrl);
  const [collapsed, setCollapsed] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const travel = useRef(0);

  const expand = useCallback(() => {
    travel.current = 0;
    setCollapsed(false);
  }, []);

  useEffect(() => {
    const webview = ref.current;
    if (!webview) return undefined;
    const updateNavigation = () => {
      setUrl(webview.getURL());
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };
    const navigate = (event: Electron.DidNavigateInPageEvent | Electron.DidNavigateEvent) => {
      if ('isMainFrame' in event && !event.isMainFrame) return;
      updateNavigation();
      expand();
    };
    const scroll = (event: Electron.IpcMessageEvent) => {
      if (event.channel !== 'browser-chrome-scroll') return;
      const data = event.args[0];
      if (!data || !Number.isFinite(data.y) || !Number.isFinite(data.deltaY)) return;
      if (data.y <= 0) {
        expand();
        return;
      }
      if (Math.sign(travel.current) !== Math.sign(data.deltaY)) travel.current = 0;
      travel.current += data.deltaY;
      // Ignore tiny trackpad movements; respond to accumulated movement in
      // either direction, including touch, keyboard and mirrored scrolling.
      if (Math.abs(travel.current) >= 16) {
        setCollapsed(travel.current > 0);
        travel.current = 0;
      }
    };
    webview.addEventListener('dom-ready', updateNavigation);
    webview.addEventListener('did-navigate', navigate);
    webview.addEventListener('did-navigate-in-page', navigate);
    webview.addEventListener('ipc-message', scroll);
    return () => {
      webview.removeEventListener('dom-ready', updateNavigation);
      webview.removeEventListener('did-navigate', navigate);
      webview.removeEventListener('did-navigate-in-page', navigate);
      webview.removeEventListener('ipc-message', scroll);
    };
  }, [ref, expand]);

  return {
    url,
    collapsed,
    canGoBack,
    canGoForward,
    expand,
    back: () => {
      if (ref.current?.canGoBack()) ref.current.goBack();
    },
    forward: () => {
      if (ref.current?.canGoForward()) ref.current.goForward();
    },
    reload: () => ref.current?.reload(),
  };
}

export type BrowserChromeState = ReturnType<typeof useBrowserChrome>;
