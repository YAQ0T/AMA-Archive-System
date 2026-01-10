import { useEffect, useMemo, useState } from 'react'
import { ArchiveTable } from '../components/ArchiveTable'
import { HierarchySelector } from '../components/HierarchySelector'
import { DocumentEditor } from '../components/DocumentEditor'
import { useArchiveContext } from '../context/ArchiveContext'

const buildStats = (archives) => {
  const totals = {
    documents: archives.length,
    tags: 0,
    value: 0,
  }

  archives.forEach((document) => {
    (document.tags || []).forEach((tag) => {
      totals.tags += 1
      totals.value += Number(tag.price || 0)
    })
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
    pagination,
    hasMore,
    changePage,
    totalCount,
  } = useArchiveContext()
  const [searchTerm, setSearchTerm] = useState(filters.name)
  const [editorState, setEditorState] = useState({ open: false, document: null })
  const [editorError, setEditorError] = useState('')
  const [editorSaving, setEditorSaving] = useState(false)

  useEffect(() => {
    setSearchTerm(filters.name)
  }, [filters.name])

  const stats = useMemo(() => buildStats(archives), [archives])
  const documentCount = typeof totalCount === 'number' ? totalCount : stats.documents
  const pageSummary = useMemo(() => {
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = from + Math.max(archives.length - 1, 0)
    const range = archives.length ? `${from}-${to}` : '0'
    const totalLabel = typeof totalCount === 'number' ? ` of ${totalCount}` : ''
    return `Showing ${range}${totalLabel} documents`
  }, [archives.length, pagination.page, pagination.pageSize, totalCount])

  const applySearch = (event) => {
    event.preventDefault()
    const derivedTags = searchTerm
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    updateFilters({
      ...filters,
      name: searchTerm,
      tags: derivedTags.length ? derivedTags : filters.tags,
    })
  }

  const handleHierarchyChange = (next) => {
    updateFilters({
      ...filters,
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

  return (
    <section className="stack">
      <header className="card">
        <div>
          <h2>Search archives</h2>
          <p className="section-description">
            Use quick search to find documents by name or tag. The live statistics below provide context for the
            current result set.
          </p>
        </div>
        <form className="search-bar" onSubmit={applySearch}>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name or tag"
          />
          <button type="submit" className="primary">
            Search
          </button>
          <button type="button" className="ghost" onClick={refresh}>
            Refresh
          </button>
        </form>
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
          <span className="metric-label">Tags</span>
          <strong className="metric-value">{stats.tags}</strong>
        </div>
        <div>
          <span className="metric-label">Total value</span>
          <strong className="metric-value">${stats.value.toFixed(2)}</strong>
        </div>
      </section>

      <div className="pagination">
        <button type="button" onClick={() => changePage(pagination.page - 1)} disabled={pagination.page === 1}>
          Previous
        </button>
        <span>
          Page {pagination.page}
          <small>{pageSummary}</small>
        </span>
        <button type="button" onClick={() => changePage(pagination.page + 1)} disabled={!hasMore}>
          Next
        </button>
      </div>

      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      <ArchiveTable archives={archives} loading={loading} onEdit={openEditor} />

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
