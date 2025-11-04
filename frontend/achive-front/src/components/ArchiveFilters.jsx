import { useEffect, useMemo, useState } from 'react'
import { HierarchySelector } from './HierarchySelector'

export const ArchiveFilters = ({ filters, onFiltersChange, onRefresh, hierarchy }) => {
  const [localFilters, setLocalFilters] = useState(filters)
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const summary = useMemo(() => {
    const parts = []
    if (filters.name) {
      parts.push(`Name contains "${filters.name}"`)
    }
    if (filters.minPrice !== '' || filters.maxPrice !== '') {
      parts.push(`Price between ${filters.minPrice || 'any'} and ${filters.maxPrice || 'any'}`)
    }
    if (filters.year) {
      parts.push(`Year: ${filters.year}`)
    }
    if (filters.merchant) {
      parts.push(`Merchant: ${filters.merchant}`)
    }
    if (filters.month) {
      parts.push(`Month: ${filters.month}`)
    }
    if (filters.tags?.length) {
      parts.push(`Tags: ${filters.tags.join(', ')}`)
    }
    return parts.join(' • ')
  }, [filters])

  const handleChange = (field, value) => {
    const next = { ...localFilters, [field]: value }
    setLocalFilters(next)
  }

  const handleHierarchyChange = (nextValue) => {
    const next = {
      ...localFilters,
      year: nextValue.year ?? '',
      merchant: nextValue.merchant ?? '',
      month: nextValue.month ?? '',
    }
    setLocalFilters(next)
  }

  const applyChanges = (event) => {
    event?.preventDefault()
    onFiltersChange?.(localFilters)
  }

  const clearFilters = () => {
    const cleared = {
      name: '',
      minPrice: '',
      maxPrice: '',
      tags: [],
      year: '',
      merchant: '',
      month: '',
    }
    setLocalFilters(cleared)
    setTagInput('')
    onFiltersChange?.(cleared)
  }

  const addTag = () => {
    const trimmed = tagInput.trim()
    if (!trimmed) {
      return
    }
    if (localFilters.tags.includes(trimmed)) {
      setTagInput('')
      return
    }
    const nextTags = [...(localFilters.tags || []), trimmed]
    const next = { ...localFilters, tags: nextTags }
    setLocalFilters(next)
    setTagInput('')
  }

  const removeTag = (tag) => {
    const nextTags = (localFilters.tags || []).filter((value) => value !== tag)
    const next = { ...localFilters, tags: nextTags }
    setLocalFilters(next)
    onFiltersChange?.(next)
  }

  return (
    <section className="card">
      <form className="filter-grid" onSubmit={applyChanges}>
        <div className="field">
          <label htmlFor="filter-name">Document name</label>
          <input
            id="filter-name"
            type="text"
            value={localFilters.name}
            onChange={(event) => handleChange('name', event.target.value)}
            placeholder="Search by document name"
          />
        </div>
        <div className="field">
          <label htmlFor="filter-min-price">Min price</label>
          <input
            id="filter-min-price"
            type="number"
            min="0"
            step="0.01"
            value={localFilters.minPrice}
            onChange={(event) => handleChange('minPrice', event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="filter-max-price">Max price</label>
          <input
            id="filter-max-price"
            type="number"
            min="0"
            step="0.01"
            value={localFilters.maxPrice}
            onChange={(event) => handleChange('maxPrice', event.target.value)}
          />
        </div>
        <HierarchySelector
          hierarchy={hierarchy}
          value={{ year: localFilters.year, merchant: localFilters.merchant, month: localFilters.month }}
          onChange={handleHierarchyChange}
          variant="grid"
        />
        <div className="field">
          <label htmlFor="filter-tags">Tags</label>
          <div className="tag-input">
            <input
              id="filter-tags"
              type="text"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addTag()
                }
              }}
              placeholder="Press Enter to add a tag"
            />
            <button type="button" className="secondary" onClick={addTag}>
              Add
            </button>
          </div>
          <div className="tag-list">
            {localFilters.tags?.map((tag) => (
              <span key={tag} className="tag">
                {tag}
                <button type="button" aria-label={`Remove ${tag}`} onClick={() => removeTag(tag)}>
                  ×
                </button>
              </span>
            ))}
            {!localFilters.tags?.length && <span className="empty">No tags selected</span>}
          </div>
        </div>
        <div className="actions filter-actions">
          <button type="submit" className="primary">
            Apply filters
          </button>
          <button type="button" onClick={clearFilters} className="secondary">
            Reset
          </button>
          <button type="button" onClick={onRefresh} className="ghost">
            Refresh data
          </button>
        </div>
      </form>
      {summary && <p className="summary">{summary}</p>}
    </section>
  )
}

