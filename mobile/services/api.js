import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'snaply_auth_token';

function inferImageMimeType(uri, fileName) {
  const source = `${fileName || ''} ${uri || ''}`.split(/[?#]/, 1)[0].toLowerCase();
  if (/\.png(?:\s|$)/.test(source)) return 'image/png';
  if (/\.webp(?:\s|$)/.test(source)) return 'image/webp';
  if (/\.gif(?:\s|$)/.test(source)) return 'image/gif';
  if (/\.heic(?:\s|$)/.test(source)) return 'image/heic';
  return 'image/jpeg';
}

export async function setAuthToken(token) {
  if (!token) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }

  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getAuthToken() {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearAuthToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}
/**
 * Save JWT token securely

/**
 * Upload image
 */
export async function uploadImageAsset(asset, onProgress) {
  if (!asset?.uri) {
    throw new Error('The selected image does not have a readable URI.');
  }

  const uri = String(asset.uri).trim();
  const fileName = String(asset.fileName || `snaply-chat-${Date.now()}.jpg`).trim().replace(/\s+/g, '-');
  const mimeType = asset.mimeType || asset.type || inferImageMimeType(uri, fileName);

  if (!mimeType.startsWith('image/')) {
    throw new Error('Please select an image file.');
  }

  const token = await getAuthToken();

  const formData = new FormData();

  formData.append('image', {
    uri,
    type: mimeType,
    name: fileName,
  });

  const response = await fetch(`${API_BASE_URL}/uploads/image`, {
    method: 'POST',
    body: formData,
    headers: {
      Accept: 'application/json',

      ...(token
        ? {
          Authorization: `Bearer ${token}`,
        }
        : {}),
    },
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error(`Image upload returned an invalid response (HTTP ${response.status}).`);
    }
  }

  const returnedMediaUrl =
    data?.mediaUrl ||
    data?.url ||
    data?.filePath ||
    data?.path;

  console.log('[Snaply] image upload response:', {
    status: response.status,
    keys: Object.keys(data || {}),
    mediaUrl: returnedMediaUrl,
  });

  if (
    response.status < 200 ||
    response.status >= 300
  ) {
    throw new Error(
      data?.message ||
      `Image upload failed (HTTP ${response.status}).`
    );
  }

  const mediaUrl = returnedMediaUrl;

  if (
    !mediaUrl ||
    /^(file:|blob:|content:|assets-library:|ph:|data:)/i.test(mediaUrl)
  ) {
    throw new Error(
      'Image upload did not return a usable server URL.'
    );
  }

  return {
    ...data,
    mediaUrl,
  };
}

function getVideoMimeType(videoUri, fileName) {
  const source = `${fileName || ''} ${videoUri || ''}`.split(/[?#]/, 1)[0].toLowerCase();
  if (/\.mov(?:\s|$)/.test(source)) return 'video/quicktime';
  if (/\.m4v(?:\s|$)/.test(source)) return 'video/x-m4v';
  if (/\.webm(?:\s|$)/.test(source)) return 'video/webm';
  return 'video/mp4';
}

function getVideoExtension(mimeType) {
  if (mimeType === 'video/quicktime') return '.mov';
  if (mimeType === 'video/x-m4v') return '.m4v';
  if (mimeType === 'video/webm') return '.webm';
  return '.mp4';
}

export async function uploadVideoAsset(videoUri, uploadUrl, fileName, onProgress) {
  const uri = typeof videoUri === 'string' ? videoUri.trim() : '';
  if (!uri) {
    throw new Error('The selected video does not have a readable URI.');
  }

  // Android's picker normally returns content:// or file://. Pass either URI
  // straight to React Native FormData so its native networking layer can read it.
  if (!/^(content|file):\/\//i.test(uri)) {
    throw new Error('The selected video URI is not a usable local file.');
  }
  if (!uploadUrl) {
    throw new Error('Video upload URL is missing.');
  }

  const mimeType = getVideoMimeType(uri, fileName);
  const name = fileName || `snaply-reel-${Date.now()}${getVideoExtension(mimeType)}`;
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: mimeType,
    name,
  });

  const token = await getAuthToken();
  let response;
  try {
    response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    throw new Error(error?.message || 'Unable to connect to the video upload server.');
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error(`Video upload returned an invalid response (HTTP ${response.status}).`);
    }
  }

  if (!response.ok) {
    throw new Error(data?.message || `Video upload failed (HTTP ${response.status}).`);
  }

  return data;
}

/**
 * Main API request function
 */
export async function apiRequest(path, options = {}) {
  const normalizedPath = path.startsWith('/')
    ? path
    : `/${path}`;

  const url = `${API_BASE_URL}${normalizedPath}`;

  const {
    headers,
    body,
    ...rest
  } = options;

  const isFormData =
    typeof FormData !== 'undefined' &&
    body instanceof FormData;

  /*
   * Get logged-in user's JWT
   */
  const token = await getAuthToken();

  try {
    const response = await fetch(url, {
      ...rest,

      body,

      headers: {
        Accept: 'application/json',

        ...(isFormData
          ? {}
          : {
            'Content-Type': 'application/json',
          }),

        /*
         * Add JWT automatically
         */
        ...(token
          ? {
            Authorization: `Bearer ${token}`,
          }
          : {}),

        ...(headers || {}),
      },
    });

    const text = await response.text();

    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = text;
      }
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data ||
        `HTTP ${response.status}: Request failed`;

      console.error(
        `API Error [${response.status}] ${url}:`,
        message
      );

      const apiError = new Error(
        typeof message === 'string'
          ? message
          : `HTTP ${response.status}: Request failed`
      );

      apiError.status = response.status;
      apiError.kind =
        response.status === 401 ? 'authentication' :
        response.status >= 400 && response.status < 500 ? 'validation' :
        'server';

      throw apiError;
    }

    return data;
  } catch (error) {
    if (
      error &&
      typeof error.status === 'number'
    ) {
      throw error;
    }

    console.error(
      `API Network Error: ${url}`,
      error?.message || error
    );

    const networkError = new Error(
      'Unable to connect to Snaply server. Check your connection and API URL.'
    );
    networkError.kind = 'network';
    throw networkError;
  }
}

export function toggleFollow(currentUserId, targetUserId, isFollowing) {
  if (!currentUserId || !targetUserId || String(currentUserId) === String(targetUserId)) {
    return Promise.reject(new Error('A valid current user and different target user are required.'));
  }

  return apiRequest(`/users/${targetUserId}/follow`, {
    method: isFollowing ? 'DELETE' : 'POST',
    body: JSON.stringify({ currentUserId }),
  });
}

/**
 * API helper methods
 */
export const api = {
  get: (path) =>
    apiRequest(path, {
      method: 'GET',
    }),

  post: (path, body) =>
    apiRequest(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: (path, body) =>
    apiRequest(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: (path, body) =>
    apiRequest(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (path, body) =>
    apiRequest(path, {
      method: 'DELETE',

      ...(body
        ? {
          body: JSON.stringify(body),
        }
        : {}),
    }),
};
