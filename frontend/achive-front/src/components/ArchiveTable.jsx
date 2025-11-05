import { useMemo } from 'react'
import { api } from '../services/api'

const formatDate = (value) => {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export const ArchiveTable = ({ archives, loading, onEdit }) => {
  const emptyState = useMemo(() => {
    if (loading) {
      return 'Loading documents…'
    }
    if (!archives.length) {
      return 'No documents match the current filters.'
    }
    return ''
  }, [archives.length, loading])

  const handlePreview = (document) => {
    api.previewDocument(document._id, document.originalName).catch((error) => {
      alert(error.message || 'Unable to preview the document right now.')
    })
  }

  const handleDownload = (document) => {
    api.downloadDocument(document._id, document.originalName).catch((error) => {
      alert(error.message || 'Unable to download the document right now.')
    })
  }

  const handleReprint = (document) => {
    api.reprintDocument(document._id, document.originalName).catch((error) => {
      alert(error.message || 'Unable to reprint the document right now.')
    })
  }

  if (emptyState) {
    return <p className="empty-state">{emptyState}</p>
  }

  return (
    <div className="table-wrapper">
      <table className="archive-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Year</th>
            <th>Merchant</th>
            <th>Month</th>
            <th>Tags</th>
            <th>Total price</th>
            <th>Uploaded</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {archives.map((document) => {
            const aggregatedPrice = document.tags?.reduce((sum, tag) => sum + Number(tag.price || 0), 0)

            return (
              <tr key={document._id}>
                <td data-label="Name">{document.originalName || 'Untitled document'}</td>
                <td data-label="Year">{document.year || '—'}</td>
                <td data-label="Merchant">{document.merchantName || '—'}</td>
                <td data-label="Month">{document.month || '—'}</td>
                <td data-label="Tags">
                  <div className="tag-list compact">
                    {document.tags?.map((tag) => {
                      const price = Number(tag.price)
                      const hasValidPrice = Number.isFinite(price) && price >= 0

                      return (
                        <span key={`${document._id}-${tag.name}-${tag.price}`} className="tag">
                          <span className="tag-name">{tag.name}</span>
                          {hasValidPrice && (
                            <span className="tag-price">{`$${price.toFixed(2)}`}</span>
                          )}
                        </span>
                      )
                    })}
                    {!document.tags?.length && <span className="empty">No tags</span>}
                  </div>
                </td>
                <td data-label="Total price">${aggregatedPrice?.toFixed(2) || '0.00'}</td>
                <td data-label="Uploaded">{formatDate(document.createdAt)}</td>
                <td data-label="Actions" className="actions table-actions">
                  {typeof onEdit === 'function' && (
                    <button type="button" className="link" onClick={() => onEdit(document)}>
                      Edit
                    </button>
                  )}
                  <button type="button" className="link" onClick={() => handlePreview(document)}>
                    Preview
                  </button>
                  <button type="button" className="link" onClick={() => handleDownload(document)}>
                    Download
                  </button>
                  <button type="button" className="link" onClick={() => handleReprint(document)}>
                    Reprint
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
