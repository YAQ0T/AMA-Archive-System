const BASE_URL = (() => {
  const envUrl = import.meta?.env?.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;

    // Vite dev/preview ports still need the backend on 4000.
    if (port === '5173' || port === '5174' || port === '4173') {
      return `${protocol}//${hostname}:4000`;
    }

    // In production (served by backend), use the exact current origin.
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
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
  } catch {
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
          } catch {
            reject(new ApiError('Upload succeeded but the server returned invalid data.'));
          }
        } else {
          try {
            const parsed = JSON.parse(responseText);
            reject(new ApiError(parsed.message || 'Upload failed.', status, parsed));
          } catch {
            reject(new ApiError('Upload failed.', status));
          }
        }
      };

      const formData = new FormData();

      if (payload.files?.length) {
        payload.files.forEach((file) => {
          formData.append('files', file);
        });
      }

      if (payload.notes) {
        formData.append('notes', payload.notes);
      }

      if (payload.tags?.length) {
        formData.append('tags', JSON.stringify(payload.tags));
      }

      if (payload.amount !== undefined && payload.amount !== null) {
        formData.append('amount', String(payload.amount));
      }

      if (payload.invoiceType) {
        formData.append('invoiceType', payload.invoiceType);
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

const listDocuments = async (
  { name, price, amount, invoiceType, year, merchant, month, limit = 10, skip = 0, includeTotal } = {},
) => {
  const query = buildQueryString({
    name,
    price,
    amount,
    invoiceType,
    year,
    merchant,
    month,
    limit,
    skip,
    includeTotal,
  });
  return request(`/api/documents${query}`);
};

const getHierarchy = () => request('/api/documents/hierarchy');

const buildDocumentFileUrl = (id) => `${BASE_URL}/api/documents/${encodeURIComponent(String(id))}/file`;

const fetchDocumentFile = async (id) => {
  const response = await fetch(buildDocumentFileUrl(id));
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
  const url = buildDocumentFileUrl(id);
  const previewWindow = window.open(url, '_blank');
  if (previewWindow) {
    try {
      previewWindow.document.title = filename || 'Document preview';
    } catch {
      // Ignore cross-origin access issues when browser opens the file viewer.
    }
  }
  return true;
};

const reprintDocument = async (id, filename) => {
  if (typeof window === 'undefined') {
    return null;
  }
  const url = buildDocumentFileUrl(id);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    setTimeout(() => {
      try {
        printWindow.document.title = filename || 'Document copy';
      } catch {
        // Ignore cross-origin access issues when browser opens the file viewer.
      }
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // Ignore browser restrictions that block programmatic print in some cases.
      }
    }, 1200);
  }
  return true;
};

const updateDocument = async (id, payload) =>
  request(`/api/documents/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

const deleteDocument = async (id) =>
  request(`/api/documents/${id}`, {
    method: 'DELETE',
  });

export const api = {
  uploadDocument,
  listDocuments,
  downloadDocument,
  previewDocument,
  reprintDocument,
  getHierarchy,
  updateDocument,
  deleteDocument,
  BASE_URL,
};

export { ApiError }
