import { useMemo, useState } from 'react'
import { ArchiveTable } from '../components/ArchiveTable'
import { useArchiveContext } from '../context/ArchiveContext'

const buildStats = (archives) => {
  const totals = {
    documents: archives.length,
    tags: 0,
    value: 0,
    archivePeriods: new Map(),
  }

  archives.forEach((document) => {
    (document.tags || []).forEach((tag) => {
      totals.tags += 1
      totals.value += Number(tag.price || 0)
      if (tag.archivePeriod) {
        totals.archivePeriods.set(tag.archivePeriod, (totals.archivePeriods.get(tag.archivePeriod) || 0) + 1)
      }
    })
  })

  return totals
}

export const Search = () => {
  const { archives, filters, updateFilters, loading, error, refresh } = useArchiveContext()
  const [searchTerm, setSearchTerm] = useState(filters.name)

  const stats = useMemo(() => buildStats(archives), [archives])

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
      </header>

      <section className="card metrics" aria-label="Result summary">
        <div>
          <span className="metric-label">Documents</span>
          <strong className="metric-value">{stats.documents}</strong>
        </div>
        <div>
          <span className="metric-label">Tags</span>
          <strong className="metric-value">{stats.tags}</strong>
        </div>
        <div>
          <span className="metric-label">Total value</span>
          <strong className="metric-value">${stats.value.toFixed(2)}</strong>
        </div>
        <div>
          <span className="metric-label">Archive mix</span>
          <div className="metric-breakdown">
            {Array.from(stats.archivePeriods.entries()).map(([period, count]) => (
              <span key={period}>
                {period}: {count}
              </span>
            ))}
            {!stats.archivePeriods.size && <span className="empty">No archive data</span>}
          </div>
        </div>
      </section>

      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      <ArchiveTable archives={archives} loading={loading} />
    </section>
  )
}

