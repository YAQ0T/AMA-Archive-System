import { useMemo } from 'react'
import { INVOICE_TYPE_LABELS } from '../constants/archive'
import { api } from '../services/api'
import { resolveDocumentAmount } from '../utils/amount'

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

export const ArchiveTable = ({ archives, loading, onEdit, onDelete, deletingId }) => {
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
            <th>Customer</th>
            <th>Month</th>
            <th>Invoice type</th>
            <th>Amount</th>
            <th>Notes</th>
            <th>Uploaded</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {archives.map((document) => {
            const amount = resolveDocumentAmount(document)
            const invoiceType = INVOICE_TYPE_LABELS[document.invoiceType] || document.invoiceType || '—'

            return (
              <tr key={document._id}>
                <td data-label="Name">{document.storedName || document.originalName || 'Untitled document'}</td>
                <td data-label="Year">{document.year || '—'}</td>
                <td data-label="Customer" dir="auto">{document.merchantName || '—'}</td>
                <td data-label="Month">{document.month || '—'}</td>
                <td data-label="Invoice type">{invoiceType}</td>
                <td data-label="Amount">${amount.toFixed(2)}</td>
                <td data-label="Notes" className="notes-cell">
                  {document.notes?.trim() ? (
                    <p className="document-notes">{document.notes}</p>
                  ) : (
                    <span className="empty">No notes</span>
                  )}
                </td>
                <td data-label="Uploaded">{formatDate(document.createdAt)}</td>
                <td data-label="Actions" className="actions table-actions">
                  {typeof onEdit === 'function' && (
                    <button type="button" className="link" onClick={() => onEdit(document)}>
                      Edit
                    </button>
                  )}
                  {typeof onDelete === 'function' && (
                    <button
                      type="button"
                      className="link danger-link"
                      onClick={() => onDelete(document)}
                      disabled={deletingId === document._id}
                    >
                      {deletingId === document._id ? 'Deleting…' : 'Delete'}
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
