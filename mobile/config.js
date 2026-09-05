import { Platform } from 'react-native';

export const DEV_USERNAME = 'alicia';

const PORT = 5000;
const PHYSICAL_LAN_IP = '10.23.8.245';
const ANDROID_EMULATOR_HOST = `http://10.0.2.2:${PORT}`;
const WEB_HOST = `http://localhost:${PORT}`;
const PRODUCTION_BACKEND_URL = 'https://snaply-server-aogm.onrender.com';

const isProduction =
  process.env.NODE_ENV === 'production'
  || (typeof __DEV__ !== 'undefined' && !__DEV__);

function stripSlash(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function isLoopback(value) {
  return /localhost|127\.0\.0\.1|10\.0\.2\.2/i.test(String(value || ''));
}

function extractIPv4(value) {
  if (!value) return null;
  const match = String(value).match(/(\d{1,3}(?:\.\d{1,3}){3})/);
  return match ? match[1] : null;
}

function getExpoLanIp() {
  try {
    const Constants = require('expo-constants').default;
    const candidates = [
      Constants.expoConfig?.hostUri,
      Constants.expoGoConfig?.debuggerHost,
      Constants.linkingUri,
      Constants.manifest2?.extra?.expoGo?.debuggerHost,
      Constants.manifest?.debuggerHost,
      Constants.expoConfig?.extra?.debuggerHost,
    ];

    for (const candidate of candidates) {
      const ip = extractIPv4(candidate);
      if (ip && !isLoopback(ip)) {
        return ip;
      }
    }
  } catch (error) {
    console.warn('[Snaply] Unable to read Expo host IP:', error?.message);
  }

  return null;
}

function resolveLocalHost() {
  if (Platform.OS === 'web') {
    return WEB_HOST;
  }

  if (String(process.env.EXPO_PUBLIC_USE_EMULATOR || '').toLowerCase() === 'true') {
    return ANDROID_EMULATOR_HOST;
  }

  const explicitLocalIp = extractIPv4(process.env.EXPO_PUBLIC_LOCAL_IP);
  if (explicitLocalIp) {
    return `http://${explicitLocalIp}:${PORT}`;
  }

  const expoIp = getExpoLanIp();
  if (expoIp) {
    return `http://${expoIp}:${PORT}`;
  }

  return `http://${PHYSICAL_LAN_IP}:${PORT}`;
}

function resolveApiHost() {
  const target = String(process.env.EXPO_PUBLIC_BACKEND_TARGET || '').trim().toLowerCase();

  // 1. Explicit target selection
  if (target === 'render' || target === 'production') {
    return PRODUCTION_BACKEND_URL;
  }

  if (target === 'local' || target === 'development') {
    return resolveLocalHost();
  }

  // 2. Custom URL provided via EXPO_PUBLIC_API_URL
  const envApi = stripSlash(process.env.EXPO_PUBLIC_API_URL);
  if (envApi) {
    if (/render\.com/i.test(envApi) || (!isLoopback(envApi) && /^https?:\/\//i.test(envApi))) {
      return envApi;
    }

    if (isLoopback(envApi)) {
      return resolveLocalHost();
    }

    return envApi;
  }

  // 3. Fallback for production builds vs development
  if (isProduction) {
    return PRODUCTION_BACKEND_URL;
  }

  return resolveLocalHost();
}

export const API_HOST = resolveApiHost();
export const MEDIA_BASE_URL = API_HOST;

function resolveSocketHost() {
  const envSocket = stripSlash(process.env.EXPO_PUBLIC_SOCKET_URL);

  if (!envSocket) {
    return API_HOST;
  }

  if (isLoopback(envSocket) && Platform.OS !== 'web') {
    return resolveLocalHost();
  }

  return envSocket;
}

export const SOCKET_BASE_URL = resolveSocketHost();

export const API_BASE_URL = `${API_HOST}/api`;

export function resolveMediaUrl(url) {
  const value = String(url || '').trim();
  if (!value || /^(blob:|file:|content:|about:)/i.test(value)) return null;

  if (/^https?:/i.test(value)) {
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();

      if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
        const androidLanUrl = new URL(value);
        androidLanUrl.hostname = PHYSICAL_LAN_IP;
        return androidLanUrl.toString();
      }

      return parsed.toString();
    } catch (error) {
      return null;
    }
  }

  const normalizedPath = value.replace(/^\/+/, '');
  return `${MEDIA_BASE_URL}/${normalizedPath}`;
}

export function resolvePostMediaUrl(post) {
  const media = post?.mediaUrl || post?.imageUrl || post?.media?.url || post?.image || post?.url;
  return resolveMediaUrl(media);
}

function isVideoMediaUrl(url) {
  return /(?:\/video\/upload\/|\.(?:mp4|mov|m4v|webm)(?:[?#]|$))/i.test(String(url || ''));
}

export function resolveMediaThumbnailUrl(media) {
  const candidates = typeof media === 'string'
    ? [media]
    : [
        media?.thumbnailUrl,
        media?.posterUrl,
        media?.thumbnail,
        media?.poster,
        media?.coverImage,
        media?.imageUrl,
        media?.image,
        media?.mediaUrl,
        media?.videoPoster,
      ];

  const thumbnail = candidates.find((candidate) => {
    if (!candidate) return false;
    if (typeof candidate !== 'string') return false;
    return !isVideoMediaUrl(candidate);
  });

  return thumbnail ? resolveMediaUrl(thumbnail) : null;
}

/**
 * Returns a still-image URL for use in <Image> thumbnail for a reel,
 * or null if no thumbnail can be derived (caller must render a fallback View).
 *
 * Cloudinary video URLs support automatic poster-frame generation by swapping
 * the extension from .mp4 to .jpg. All other hosts (Google Storage, local
 * /uploads/reels/, etc.) do not support this, so we return null for them.
 *
 * The original videoUrl is NEVER modified here — the Reel Viewer continues
 * to receive the unchanged .mp4 URL.
 */
export function getReelThumbnail(videoUrl) {
  const url = String(videoUrl || '').trim();
  if (!url) return null;
  // Cloudinary: swap extension to get auto-generated poster frame
  if (/cloudinary\.com/i.test(url)) {
    return url.replace(/\.mp4(\?.*)?$/i, '.jpg');
  }
  // All other hosts — no thumbnail can be derived
  return null;
}

export function resolveReelThumbnailUrl(reel) {
  return resolveMediaThumbnailUrl(reel) || getReelThumbnail(reel?.videoUrl || reel?.mediaUrl);
}

if (__DEV__) {
  console.log('[Snaply] network', {
    platform: Platform.OS,
    target: process.env.EXPO_PUBLIC_BACKEND_TARGET || 'local',
    apiHost: API_HOST,
    apiBaseUrl: API_BASE_URL,
    socketUrl: SOCKET_BASE_URL,
    mediaBaseUrl: MEDIA_BASE_URL,
  });
}
