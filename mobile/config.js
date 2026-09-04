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

function resolveApiHost() {
  const envApi = stripSlash(process.env.EXPO_PUBLIC_API_URL);

  if (envApi && (Platform.OS === 'web' || !isLoopback(envApi))) {
    return envApi;
  }

  if (isProduction) {
    return PRODUCTION_BACKEND_URL;
  }

  if (Platform.OS === 'web') {
    return WEB_HOST;
  }

  if (String(process.env.EXPO_PUBLIC_USE_EMULATOR || '').toLowerCase() === 'true') {
    return ANDROID_EMULATOR_HOST;
  }

  const expoIp = getExpoLanIp();
  if (expoIp) {
    return `http://${expoIp}:${PORT}`;
  }

  return `http://${PHYSICAL_LAN_IP}:${PORT}`;
}

export const API_HOST = resolveApiHost();
export const MEDIA_BASE_URL = API_HOST;

const envSocket = stripSlash(process.env.EXPO_PUBLIC_SOCKET_URL);
export const SOCKET_BASE_URL =
  envSocket && (Platform.OS === 'web' || !isLoopback(envSocket))
    ? envSocket
    : API_HOST;

export const API_BASE_URL = `${API_HOST}/api`;

export function resolveMediaUrl(url) {
  const value = String(url || '').trim();
  if (!value || /^(blob:|file:|content:|about:)/i.test(value)) return null;

  if (/^https?:/i.test(value)) {
    try {
      const parsed = new URL(value);
      return parsed.toString();
    } catch (error) {
      return null;
    }
  }

  const normalizedPath = value.replace(/^\/+/, '');
  return `${MEDIA_BASE_URL}/${normalizedPath}`;
}

if (__DEV__) {
  console.log('[Snaply] network', {
    platform: Platform.OS,
    apiHost: API_HOST,
    apiBaseUrl: API_BASE_URL,
    socketUrl: SOCKET_BASE_URL,
    mediaBaseUrl: MEDIA_BASE_URL,
  });
}
