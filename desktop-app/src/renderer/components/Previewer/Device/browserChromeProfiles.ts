import {getIPhone18Variant, getIPhoneDuoVariant, type Device} from 'common/deviceList';

// Layout facts from Mobile simulator 4.22.2's shipped header/footer components.
// Official package: ckejmhbmlajgoklhgbapkiccekfoccmk, js/simulator.js and
// css/simulator.css. Component scope IDs: legacy 478a7a94/0b1a127c,
// modern 9eb480aa/d63a6f22, Android 9abaf552, glass 7e178770/27ac0a0e.
// Models absent from the extension use the corresponding platform defaults;
// non-iOS mobile devices use its generic Chrome header. Desktop is unchanged.
// Glass uses the reference's 45px pill and 90→55px container, reserving space
// for it so fixed webpage controls remain reachable in the embedded guest.
export function browserChromeMetrics(device: Device, rotated: boolean, collapsed: boolean) {
  const enabled = device.isMobileCapable;
  const duo = getIPhoneDuoVariant(device);
  // Duo's side rail follows the device rotation, not the screen aspect ratio.
  // Source components 23d1564e / 2a53036a / 88543c0a: 84px rail,
  // unfolded header = 24px padding + 48px controls + 5px padding.
  if (duo)
    return {
      enabled,
      ios: true,
      android: false,
      tablet: duo === 'unfolded',
      family: duo === 'folded' ? 'safari-duo-folded' : 'safari-duo-unfolded',
      compact: duo === 'folded' && collapsed,
      topControls: duo === 'unfolded',
      topAddress: duo === 'unfolded',
      status: 0,
      statusProfile: {
        fontSize: 16,
        fontWeight: 700,
        iconHeight: 42,
        sideWidth: undefined,
        padding: '0',
      },
      addressHeight: 0,
      home: 0,
      top: enabled && duo === 'unfolded' ? 77 : 0,
      bottom: enabled && duo === 'folded' ? (collapsed ? 55 : 90) : 0,
      left: enabled && duo === 'folded' && rotated ? 84 : 0,
      right: enabled && duo === 'folded' && !rotated ? 84 : 0,
    };
  const android = /Android/i.test(device.userAgent);
  const ios =
    !/Windows Phone/i.test(device.userAgent) &&
    !android &&
    /iPhone|iPad|iPod/i.test(`${device.name} ${device.userAgent}`);
  const tablet =
    device.type === 'tablet' ||
    /iPad|Galaxy Tab|Nexus (7|10)|PlayBook|Surface Duo/i.test(device.name);
  const width = rotated ? device.height : device.width;
  const height = rotated ? device.width : device.height;
  const landscape = width > height;
  const generation = Number(device.name.match(/iPhone\s+(\d+)/i)?.[1]);
  const osVersion = Number(device.userAgent.match(/(?:iPhone OS|CPU OS) (\d+)/)?.[1]);
  // Built-in device UAs are sometimes older than their hardware (13 Pro Max
  // has an iOS 13 UA). Match the extension's presets; custom UAs are explicit.
  const liquid = ios && !tablet && (device.isCustom ? osVersion >= 26 : generation >= 15);
  const modern = ios && !tablet && (device.isCustom ? osVersion >= 15 : generation >= 13);
  const island = generation >= 15 || (generation === 14 && /Pro/i.test(device.name));
  const notch =
    island ||
    /iPhone\s+(X|11|12|13|14)/i.test(device.name) ||
    (device.isCustom && ios && !tablet && device.height >= 780);
  const family = !ios
    ? 'chrome'
    : tablet
      ? 'safari-tablet'
      : liquid
        ? 'safari-glass'
        : modern
          ? 'safari-modern'
          : 'safari-legacy';
  const topControls = ios && (tablet || (landscape && !liquid));
  const topAddress = !ios || topControls || (!modern && !liquid);
  const compact = collapsed && !(ios && tablet);
  let status = 32;
  let padding = tablet ? '0 15px' : '0 23px';
  let fontSize = 14;
  let fontWeight = ios ? 700 : 400;
  let iconHeight = ios ? 10 : 13;
  let sideWidth: string | undefined;
  if (ios) {
    if (tablet || (!modern && !notch)) {
      status = 25;
      padding = tablet ? '11px 15px 0' : '0 12px';
    } else if (!modern) {
      status = 35;
      padding = '0';
      sideWidth = /12 Mini/i.test(device.name) ? '23%' : '27%';
    } else {
      let ratio = island ? 0.07 : 0.051;
      if (liquid) {
        ratio = /Air/i.test(device.name)
          ? 0.084
          : generation >= 17 || /16 Pro Max/i.test(device.name)
            ? 0.075
            : generation >= 15 && !/16 Pro$/i.test(device.name)
              ? 0.066
              : 0.051;
      }
      status = device.height * ratio;
      fontSize = liquid ? 18 : 16;
      fontWeight = liquid ? 600 : 700;
      iconHeight = 12;
      sideWidth = '36%';
      padding = '0';
      if (/16 (Plus|Pro Max)/i.test(device.name)) {
        fontSize *= 1.1;
        iconHeight *= 1.1;
      }
    }
    if (landscape && !tablet) {
      status = liquid ? fontSize * 1.1 + 6 : 0;
      padding = '3px 50px';
    }
  } else if (/Pixel 5$/i.test(device.name)) {
    status = 42;
    padding = '17px 23px 0 51px';
  } else if (/Pixel 10(?: Pro| Pro Fold)?$/i.test(device.name)) {
    status = 54; // 45px with the extension's 1.2 zoom.
    padding = '0 39.6px';
    fontSize *= 1.2;
    iconHeight *= 1.2;
  } else if (/Galaxy S26 Ultra/i.test(device.name)) {
    status = 45;
  } else if (/Infinix Hot 70|Razr 70 Ultra|Galaxy A17/i.test(device.name)) {
    status = 46.2; // 42px × 1.1.
    fontSize *= 1.1;
    iconHeight *= 1.1;
  } else if (/OnePlus Nord 2/i.test(device.name)) {
    padding = '13px 23px 0 65px';
  } else if (/Oppo Find X3 Pro/i.test(device.name)) {
    padding = '12px 23px 0 58px';
  } else if (/Huawei P30 Pro/i.test(device.name)) {
    padding = '0 19px';
  }
  const legacyAddress = !notch && !tablet ? 46 : 50;
  const addressHeight = topAddress
    ? !ios
      ? compact
        ? 0
        : 53
      : compact
        ? legacyAddress - 27
        : legacyAddress
    : 0;
  const bottom =
    !ios || topControls
      ? 0
      : liquid
        ? compact
          ? 55
          : 90
        : modern
          ? compact
            ? 48
            : 128
          : compact
            ? 0
            : notch
              ? 83
              : 44;
  return {
    // The reference keeps landscape iPhone content within 88% of the screen
    // unless viewport-fit=cover is requested; leave room for the island.
    left: enabled && getIPhone18Variant(device) && landscape ? width * 0.06 : 0,
    right: enabled && getIPhone18Variant(device) && landscape ? width * 0.06 : 0,
    enabled,
    ios,
    android,
    tablet,
    family,
    compact,
    topControls,
    topAddress,
    status: enabled ? status : 0,
    statusProfile: {fontSize, fontWeight, iconHeight, sideWidth, padding},
    addressHeight,
    home: ios && (notch || tablet) && !liquid ? 13 : 0,
    top: enabled ? status + addressHeight + (ios && topAddress ? 1 : 0) : 0,
    bottom: enabled ? bottom : 0,
  };
}
