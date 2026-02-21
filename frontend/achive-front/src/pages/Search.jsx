import { useEffect, useMemo, useState } from 'react'
import { ArchiveTable } from '../components/ArchiveTable'
import { HierarchySelector } from '../components/HierarchySelector'
import { DocumentEditor } from '../components/DocumentEditor'
import { INVOICE_TYPE_LABELS, INVOICE_TYPES } from '../constants/archive'
import { useArchiveContext } from '../context/ArchiveContext'
import { normaliseAmountInput, resolveDocumentAmount } from '../utils/amount'

const buildStats = (archives) => {
  const totals = {
    documents: archives.length,
    amount: 0,
  }

  archives.forEach((document) => {
    totals.amount += resolveDocumentAmount(document)
  })

  return totals
}

export const Search = () => {
  const {
    archives,
    filters,
    updateFilters,
    loading,
    error,
    refresh,
    hierarchy,
    editDocument,
    deleteDocument,
    pagination,
    hasMore,
    changePage,
    changePageSize,
    pageSizeOptions,
    totalCount,
  } = useArchiveContext()

  const [searchTerm, setSearchTerm] = useState(filters.name)
  const [amountInput, setAmountInput] = useState(filters.amount)
  const [invoiceType, setInvoiceType] = useState(filters.invoiceType)
  const [editorState, setEditorState] = useState({ open: false, document: null })
  const [editorError, setEditorError] = useState('')
  const [editorSaving, setEditorSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')

  useEffect(() => {
    setSearchTerm(filters.name)
  }, [filters.name])

  useEffect(() => {
    setAmountInput(filters.amount)
  }, [filters.amount])

  useEffect(() => {
    setInvoiceType(filters.invoiceType)
  }, [filters.invoiceType])

  const stats = useMemo(() => buildStats(archives), [archives])
  const documentCount = typeof totalCount === 'number' ? totalCount : stats.documents
  const pageSummary = useMemo(() => {
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = from + Math.max(archives.length - 1, 0)
    const range = archives.length ? `${from}-${to}` : '0'
    const totalLabel = typeof totalCount === 'number' ? ` of ${totalCount}` : ''
    return `Showing ${range}${totalLabel} documents`
  }, [archives.length, pagination.page, pagination.pageSize, totalCount])
  const totalPages = useMemo(() => {
    if (typeof totalCount !== 'number') {
      return null
    }
    return Math.max(1, Math.ceil(totalCount / pagination.pageSize))
  }, [pagination.pageSize, totalCount])

  const applySearch = (event) => {
    event.preventDefault()
    updateFilters({
      ...filters,
      name: searchTerm,
      amount: normaliseAmountInput(amountInput),
      invoiceType,
    })
  }

  const handleHierarchyChange = (next) => {
    updateFilters({
      ...filters,
      amount: normaliseAmountInput(amountInput),
      invoiceType,
      year: next.year ?? '',
      merchant: next.merchant ?? '',
      month: next.month ?? '',
    })
  }

  const openEditor = (document) => {
    setEditorState({ open: true, document })
    setEditorError('')
  }

  const closeEditor = () => {
    setEditorState({ open: false, document: null })
    setEditorError('')
    setEditorSaving(false)
  }

  const submitEditor = async (payload) => {
    if (!editorState.document) {
      return
    }

    setEditorSaving(true)
    setEditorError('')

    try {
      await editDocument(editorState.document._id, payload)
      closeEditor()
    } catch (submitError) {
      setEditorError(submitError.message || 'Unable to update the document.')
      setEditorSaving(false)
    }
  }

  const removeArchive = async (document) => {
    if (!document?._id) {
      return
    }

    const displayName = document.storedName || document.originalName || 'this document'
    const approved = window.confirm(`Delete "${displayName}" permanently?`)
    if (!approved) {
      return
    }

    setDeletingId(document._id)
    try {
      await deleteDocument(document._id)
    } catch (removeError) {
      alert(removeError?.message || 'Unable to delete this document right now.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <section className="stack">
      <header className="card">
        <div>
          <h2>Search archives</h2>
          <p className="section-description">
            Search by document name, then filter by amount and invoice type.
          </p>
        </div>

        <form className="search-bar" onSubmit={applySearch}>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by document name"
          />
          <button type="submit" className="primary">
            Search
          </button>
          <button type="button" className="ghost" onClick={refresh}>
            Refresh
          </button>
        </form>

        <div className="search-extra-filters">
          <div className="field">
            <label htmlFor="search-amount">المبلغ (Amount)</label>
            <input
              id="search-amount"
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(event) => setAmountInput(normaliseAmountInput(event.target.value))}
              placeholder="Any"
              dir="ltr"
            />
          </div>

          <div className="field">
            <label htmlFor="search-invoice-type">نوع الفاتورة</label>
            <select
              id="search-invoice-type"
              value={invoiceType}
              onChange={(event) => setInvoiceType(event.target.value)}
            >
              <option value="">Any</option>
              {INVOICE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="secondary" onClick={() => {
            setAmountInput('')
            setInvoiceType('')
            updateFilters({ ...filters, amount: '', invoiceType: '' })
          }}>
            Reset quick filters
          </button>
        </div>

        <div className="hierarchy-filter-bar">
          <HierarchySelector
            hierarchy={hierarchy}
            value={{ year: filters.year, merchant: filters.merchant, month: filters.month }}
            onChange={handleHierarchyChange}
            variant="inline"
          />
        </div>
      </header>

      <section className="card metrics" aria-label="Result summary">
        <div>
          <span className="metric-label">Documents</span>
          <strong className="metric-value">{documentCount}</strong>
        </div>
        <div>
          <span className="metric-label">Total amount</span>
          <strong className="metric-value">${stats.amount.toFixed(2)}</strong>
        </div>
        <div>
          <span className="metric-label">Invoice type</span>
          <strong className="metric-value metric-value-small">
            {invoiceType ? INVOICE_TYPE_LABELS[invoiceType] || invoiceType : 'All'}
          </strong>
        </div>
      </section>

      <div className="pagination">
        <div className="page-size-control">
          <label htmlFor="search-page-size">Per page</label>
          <select
            id="search-page-size"
            value={pagination.pageSize}
            onChange={(event) => changePageSize(Number(event.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => changePage(pagination.page - 1)} disabled={pagination.page === 1}>
          Previous
        </button>
        <span>
          Page {pagination.page}{totalPages ? ` of ${totalPages}` : ''}
          <small>{pageSummary}</small>
        </span>
        <button
          type="button"
          onClick={() => changePage(pagination.page + 1)}
          disabled={totalPages ? pagination.page >= totalPages : !hasMore}
        >
          Next
        </button>
      </div>

      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      <ArchiveTable
        archives={archives}
        loading={loading}
        onEdit={openEditor}
        onDelete={removeArchive}
        deletingId={deletingId}
      />

      <DocumentEditor
        open={editorState.open}
        document={editorState.document}
        onClose={closeEditor}
        onSubmit={submitEditor}
        saving={editorSaving}
        error={editorError}
      />
    </section>
  )
}
