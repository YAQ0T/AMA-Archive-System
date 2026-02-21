import { useEffect, useMemo, useState } from 'react'
import { INVOICE_TYPE_LABELS, INVOICE_TYPES } from '../constants/archive'
import { normaliseAmountInput } from '../utils/amount'
import { HierarchySelector } from './HierarchySelector'

export const ArchiveFilters = ({ filters, onFiltersChange, onRefresh, hierarchy }) => {
  const [localFilters, setLocalFilters] = useState(filters)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const summary = useMemo(() => {
    const parts = []
    if (filters.name) {
      parts.push(`Name contains "${filters.name}"`)
    }
    if (filters.amount !== '') {
      parts.push(`Amount: ${filters.amount}`)
    }
    if (filters.invoiceType) {
      parts.push(`Invoice type: ${INVOICE_TYPE_LABELS[filters.invoiceType] || filters.invoiceType}`)
    }
    if (filters.year) {
      parts.push(`Year: ${filters.year}`)
    }
    if (filters.merchant) {
      parts.push(`Customer: ${filters.merchant}`)
    }
    if (filters.month) {
      parts.push(`Month: ${filters.month}`)
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
      amount: '',
      invoiceType: '',
      year: '',
      merchant: '',
      month: '',
    }
    setLocalFilters(cleared)
    onFiltersChange?.(cleared)
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
          <label htmlFor="filter-amount">المبلغ (Amount)</label>
          <input
            id="filter-amount"
            type="text"
            inputMode="decimal"
            value={localFilters.amount}
            onChange={(event) => handleChange('amount', normaliseAmountInput(event.target.value))}
            placeholder="Exact amount"
            dir="ltr"
          />
        </div>

        <div className="field">
          <label htmlFor="filter-invoice-type">نوع الفاتورة</label>
          <select
            id="filter-invoice-type"
            value={localFilters.invoiceType}
            onChange={(event) => handleChange('invoiceType', event.target.value)}
          >
            <option value="">Any</option>
            {INVOICE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <HierarchySelector
          hierarchy={hierarchy}
          value={{ year: localFilters.year, merchant: localFilters.merchant, month: localFilters.month }}
          onChange={handleHierarchyChange}
          variant="grid"
        />

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
