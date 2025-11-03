import { useMemo } from 'react'
import { ArchiveFilters } from '../components/ArchiveFilters'
import { ArchiveTable } from '../components/ArchiveTable'
import { useArchiveContext } from '../context/ArchiveContext'

export const Archives = () => {
  const { archives, filters, updateFilters, loading, error, changePage, pagination, hasMore, refresh, hierarchy } =
    useArchiveContext()

  const pageSummary = useMemo(() => {
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = from + Math.max(archives.length - 1, 0)
    return `Showing ${archives.length ? `${from}-${to}` : '0'} documents`
  }, [archives.length, pagination.page, pagination.pageSize])

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
          <button type="button" onClick={() => changePage(pagination.page - 1)} disabled={pagination.page === 1}>
            Previous
          </button>
          <span>
            Page {pagination.page}
            <small>{pageSummary}</small>
          </span>
          <button type="button" onClick={() => changePage(pagination.page + 1)} disabled={!hasMore && archives.length < pagination.pageSize}>
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

      <ArchiveTable archives={archives} loading={loading} />
    </section>
  )
}

