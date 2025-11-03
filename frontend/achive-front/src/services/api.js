const BASE_URL = (() => {
  const envUrl = import.meta?.env?.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }
  return 'http://localhost:4000';
})();

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const parseError = async (response) => {
  try {
    const payload = await response.clone().json();
    if (payload?.message) {
      return payload.message;
    }
    if (payload?.errors) {
      return payload.errors.map((err) => err.msg || err.message).join(', ');
    }
  } catch (error) {
    return response.statusText || 'Unexpected error';
  }
  return response.statusText || 'Unexpected error';
};

const request = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await parseError(response);
    throw new ApiError(message, response.status);
  }

  return response.json();
};

const buildQueryString = (params) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    searchParams.append(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const uploadDocument = (payload, { onProgress } = {}) =>
  new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/api/documents`);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }
        if (typeof onProgress === 'function') {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onerror = () => {
        reject(new ApiError('Unable to reach the archive service.'));
      };

      xhr.onload = () => {
        const { status, responseText } = xhr;
        if (status >= 200 && status < 300) {
          try {
            const data = JSON.parse(responseText);
            resolve(data);
          } catch (error) {
            reject(new ApiError('Upload succeeded but the server returned invalid data.'));
          }
        } else {
          try {
            const parsed = JSON.parse(responseText);
            reject(new ApiError(parsed.message || 'Upload failed.', status, parsed));
          } catch (_error) {
            reject(new ApiError('Upload failed.', status));
          }
        }
      };

      const formData = new FormData();
      formData.append('file', payload.file);

      if (payload.notes) {
        formData.append('notes', payload.notes);
      }

      if (payload.tags?.length) {
        formData.append('tags', JSON.stringify(payload.tags));
      }

      if (payload.year) {
        formData.append('year', String(payload.year));
      }

      if (payload.merchant) {
        formData.append('merchant', payload.merchant);
      }

      if (payload.month) {
        formData.append('month', payload.month);
      }

      xhr.send(formData);
    } catch (error) {
      reject(new ApiError(error.message || 'Unexpected error while uploading.'));
    }
  });

const listDocuments = async ({
  name,
  archivePeriod,
  price,
  year,
  merchant,
  month,
  limit = 10,
  skip = 0,
} = {}) => {
  const query = buildQueryString({
    name,
    archive: archivePeriod,
    price,
    year,
    merchant,
    month,
    limit,
    skip,
  });
  return request(`/api/documents${query}`);
};

const getHierarchy = () => request('/api/documents/hierarchy');

const fetchDocumentFile = async (id) => {
  const response = await fetch(`${BASE_URL}/api/documents/${id}/file`);
  if (!response.ok) {
    const message = await parseError(response);
    throw new ApiError(message, response.status);
  }
  return response.blob();
};

const downloadDocument = async (id, filename) => {
  if (typeof window === 'undefined') {
    return null;
  }
  const blob = await fetchDocumentFile(id);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || `document-${id}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
};

const previewDocument = async (id, filename) => {
  if (typeof window === 'undefined') {
    return null;
  }
  const blob = await fetchDocumentFile(id);
  const url = URL.createObjectURL(blob);
  const previewWindow = window.open(url, '_blank');
  if (previewWindow) {
    previewWindow.onload = () => {
      previewWindow.document.title = filename || 'Document preview';
    };
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
};

const reprintDocument = async (id, filename) => {
  if (typeof window === 'undefined') {
    return null;
  }
  const blob = await fetchDocumentFile(id);
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.document.title = filename || 'Document copy';
      printWindow.focus();
      printWindow.print();
    };
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
};

export const api = {
  uploadDocument,
  listDocuments,
  downloadDocument,
  previewDocument,
  reprintDocument,
  getHierarchy,
  BASE_URL,
};

export { ApiError }

