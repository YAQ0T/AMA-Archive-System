import { useMemo, useState } from 'react'
import { ArchiveFilters } from '../components/ArchiveFilters'
import { ArchiveTable } from '../components/ArchiveTable'
import { useArchiveContext } from '../context/ArchiveContext'

export const Archives = () => {
  const {
    archives,
    filters,
    updateFilters,
    loading,
    error,
    changePage,
    changePageSize,
    pagination,
    hasMore,
    refresh,
    hierarchy,
    totalCount,
    deleteDocument,
    pageSizeOptions,
  } =
    useArchiveContext()
  const [deletingId, setDeletingId] = useState('')

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
          <h2>Archive overview</h2>
          <p className="section-description">
            Filter, paginate, and act on the archive inventory. The filters are shared with the search
            experience to keep your workflow consistent.
          </p>
        </div>
        <div className="pagination">
          <div className="page-size-control">
            <label htmlFor="archives-page-size">Per page</label>
            <select
              id="archives-page-size"
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
      </header>

      <ArchiveFilters
        filters={filters}
        onFiltersChange={updateFilters}
        onRefresh={refresh}
        hierarchy={hierarchy}
      />

      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      <ArchiveTable
        archives={archives}
        loading={loading}
        onDelete={removeArchive}
        deletingId={deletingId}
      />
    </section>
  )
}
