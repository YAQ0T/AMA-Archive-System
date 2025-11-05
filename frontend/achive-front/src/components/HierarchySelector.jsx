import { useMemo } from 'react'

const getYearEntry = (hierarchyYears, year) =>
  hierarchyYears.find((entry) => String(entry.year) === String(year))

const getMerchantEntry = (merchants, merchant) => merchants.find((entry) => entry.name === merchant)

export const HierarchySelector = ({ hierarchy, value = {}, onChange, variant = 'grid' }) => {
  const years = hierarchy?.years ?? []

  const yearEntry = useMemo(() => getYearEntry(years, value.year), [years, value.year])
  const merchants = useMemo(() => yearEntry?.merchants ?? [], [yearEntry])
  const merchantEntry = useMemo(() => getMerchantEntry(merchants, value.merchant), [merchants, value.merchant])
  const months = useMemo(() => {
    const rawMonths = merchantEntry?.months ?? []
    return rawMonths
      .map((entry) => {
        if (typeof entry === 'string') {
          return { name: entry, documents: [] }
        }
        if (entry && typeof entry === 'object') {
          const name = entry.name ?? entry.month ?? ''
          if (!name) {
            return null
          }
          return { ...entry, name }
        }
        return null
      })
      .filter(Boolean)
  }, [merchantEntry])

  const handleYearChange = (event) => {
    const nextYear = event.target.value
    onChange?.({
      ...value,
      year: nextYear,
      merchant: '',
      month: '',
    })
  }

  const handleMerchantChange = (event) => {
    const nextMerchant = event.target.value
    onChange?.({
      ...value,
      merchant: nextMerchant,
      month: '',
    })
  }

  const handleMonthChange = (event) => {
    onChange?.({
      ...value,
      month: event.target.value,
    })
  }

  const fields = [
    <div key="year" className="field">
      <label htmlFor="filter-year">Year</label>
      <select id="filter-year" value={value.year ?? ''} onChange={handleYearChange}>
        <option value="">Any</option>
        {years.map((entry) => (
          <option key={entry.year} value={entry.year}>
            {entry.year}
          </option>
        ))}
      </select>
    </div>,
    <div key="merchant" className="field">
      <label htmlFor="filter-merchant">Merchant</label>
      <select
        id="filter-merchant"
        value={value.merchant ?? ''}
        onChange={handleMerchantChange}
        disabled={!yearEntry}
      >
        <option value="">{yearEntry ? 'Any' : 'Select year first'}</option>
        {merchants.map((entry) => (
          <option key={entry.name} value={entry.name}>
            {entry.name}
          </option>
        ))}
      </select>
    </div>,
    <div key="month" className="field">
      <label htmlFor="filter-month">Month</label>
      <select
        id="filter-month"
        value={value.month ?? ''}
        onChange={handleMonthChange}
        disabled={!merchantEntry}
      >
        <option value="">{merchantEntry ? 'Any' : 'Select merchant first'}</option>
        {months.map((month) => (
          <option key={month.name} value={month.name}>
            {month.name}
          </option>
        ))}
      </select>
    </div>,
  ]

  if (variant === 'grid') {
    return fields
  }

  return <div className="hierarchy-selector-inline">{fields}</div>
}
