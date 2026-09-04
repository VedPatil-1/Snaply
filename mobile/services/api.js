import { File, UploadType } from 'expo-file-system';
import { API_BASE_URL } from '../config';

export async function uploadImageAsset(asset, onProgress) {
  if (!asset?.uri) throw new Error('The selected image does not have a readable URI.');

  const mimeType = asset.mimeType || 'image/jpeg';
  if (!mimeType.startsWith('image/')) throw new Error('Please select an image file.');

  const file = new File(asset.uri);
  const response = await file.upload(`${API_BASE_URL}/uploads/image`, {
    httpMethod: 'POST',
    uploadType: UploadType.MULTIPART,
    fieldName: 'image',
    mimeType,
    headers: { Accept: 'application/json' },
    onProgress,
  });

  let data = null;
  try {
    data = response.body ? JSON.parse(response.body) : null;
  } catch (error) {
    throw new Error(`Image upload returned an invalid response (HTTP ${response.status}).`);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(data?.message || `Image upload failed (HTTP ${response.status}).`);
  }

  const mediaUrl = data?.mediaUrl || data?.url || data?.filePath;
  if (!mediaUrl || /^(file:|blob:|content:)/i.test(mediaUrl)) {
    throw new Error('Image upload did not return a usable server URL.');
  }

  return { ...data, mediaUrl };
}

export async function apiRequest(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;
  const { headers, body, ...rest } = options;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  try {
    const response = await fetch(url, {
      ...rest,
      body,
      headers: {
        Accept: 'application/json',
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
      const message = data?.message || data || `HTTP ${response.status}: Request failed`;
      console.error(`API Error [${response.status}] ${url}:`, message);
      const apiError = new Error(typeof message === 'string' ? message : `HTTP ${response.status}: Request failed`);
      apiError.status = response.status;
      throw apiError;
    }

    return data;
  } catch (error) {
    if (error && typeof error.status === 'number') {
      throw error;
    }

    console.error(`API Network Error: ${url}`, error?.message || error);
    throw new Error('Unable to connect to Snaply server');
  }
}

export const api = {
  get: (path) => apiRequest(path, { method: 'GET' }),
  post: (path, body) => apiRequest(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path, body) =>
    apiRequest(path, {
      method: 'DELETE',
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
};
