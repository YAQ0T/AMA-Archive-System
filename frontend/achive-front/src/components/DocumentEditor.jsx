import { useEffect, useMemo, useState } from 'react'
import { MONTHS } from '../constants/archive'

const createTagRow = (tag) => ({
  name: tag?.name ?? '',
  price:
    tag?.price !== undefined && tag?.price !== null && tag?.price !== ''
      ? String(tag.price)
      : '',
})

const createInitialTags = () => []

export const DocumentEditor = ({ open, document, onClose, onSubmit, saving, error }) => {
  const [notes, setNotes] = useState('')
  const [year, setYear] = useState('')
  const [merchant, setMerchant] = useState('')
  const [month, setMonth] = useState(() => MONTHS[new Date().getMonth()] ?? MONTHS[0])
  const [tags, setTags] = useState(() => createInitialTags())
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!open || !document) {
      return
    }

    setNotes(document.notes ?? '')
    setYear(document.year ? String(document.year) : '')
    setMerchant(document.merchantName ?? '')
    setMonth(document.month && MONTHS.includes(document.month) ? document.month : MONTHS[0])
    const sourceTags = Array.isArray(document.tags) ? document.tags : []
    setTags(sourceTags.map(createTagRow))
    setFormError('')
  }, [document, open])

  useEffect(() => {
    if (!open) {
      setFormError('')
    }
  }, [open])

  const handleTagChange = (index, patch) => {
    setTags((current) =>
      current.map((tag, tagIndex) => (tagIndex === index ? { ...tag, ...patch } : tag)),
    )
  }

  const addTagRow = () => {
    setTags((current) => [...current, createTagRow()])
  }

  const removeTagRow = (index) => {
    setTags((current) => current.filter((_, tagIndex) => tagIndex !== index))
  }

  const monthOptions = useMemo(() => MONTHS, [])

  const handleSubmit = (event) => {
    event.preventDefault()
    setFormError('')

    const trimmedMerchant = merchant.trim()
    const numericYear = Number(year)

    if (!Number.isFinite(numericYear) || numericYear < 1900 || numericYear > 9999) {
      setFormError('Please provide a valid year between 1900 and 9999.')
      return
    }

    if (!trimmedMerchant) {
      setFormError('Merchant name is required.')
      return
    }

    if (!monthOptions.includes(month)) {
      setFormError('Please select a valid month.')
      return
    }

    const cleanedTags = tags
      .map((tag) => {
        const trimmedName = tag.name.trim()
        if (!trimmedName) {
          return null
        }
        const numericPrice = Number(tag.price)
        if (tag.price === '' || Number.isNaN(numericPrice) || numericPrice < 0) {
          return null
        }
        return {
          name: trimmedName,
          price: numericPrice,
        }
      })
      .filter(Boolean)

    onSubmit({
      notes,
      tags: cleanedTags,
      year: numericYear,
      merchant: trimmedMerchant,
      month,
    })
  }

  if (!open || !document) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="document-editor-title">
        <header className="modal-header">
          <div>
            <h3 id="document-editor-title">Edit document</h3>
            <p className="section-description">
              Update document metadata, adjust yearly assignments, or refine pricing tags. Changes are applied
              immediately after saving.
            </p>
          </div>
          <button type="button" className="ghost" onClick={onClose} disabled={saving}>
            Close
          </button>
        </header>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="editor-notes">Notes</label>
            <textarea
              id="editor-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Describe this document for your team…"
            />
          </div>

          <div className="upload-metadata-grid">
            <div className="field">
              <label htmlFor="editor-year">Year</label>
              <input
                id="editor-year"
                type="number"
                min="1900"
                max="9999"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="editor-merchant">Merchant</label>
              <input
                id="editor-merchant"
                type="text"
                value={merchant}
                onChange={(event) => setMerchant(event.target.value)}
                placeholder="e.g. ACME Trading Co."
                required
              />
            </div>
            <div className="field">
              <label htmlFor="editor-month">Month</label>
              <select
                id="editor-month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                required
              >
                {monthOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="tags-fieldset">
            <legend>Metadata tags (optional)</legend>
            <p className="hint">Update pricing and keyword tags if you use them. Leave empty to skip.</p>
            {tags.length === 0 && <p className="hint">No metadata tags added.</p>}
            {tags.map((tag, index) => (
              <div key={`editor-tag-${index}`} className="tag-row">
                <div className="field">
                  <label htmlFor={`editor-tag-name-${index}`}>Name</label>
                  <input
                    id={`editor-tag-name-${index}`}
                    type="text"
                    value={tag.name}
                    onChange={(event) => handleTagChange(index, { name: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`editor-tag-price-${index}`}>Price</label>
                  <input
                    id={`editor-tag-price-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={tag.price}
                    onChange={(event) => handleTagChange(index, { price: event.target.value })}
                  />
                  {tag.price !== '' && Number(tag.price) === 0 && (
                    <p className="hint warning" role="alert">Price is currently set to 0.</p>
                  )}
                </div>
                <button type="button" className="ghost" onClick={() => removeTagRow(index)} disabled={saving}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={addTagRow} disabled={saving}>
              Add another tag
            </button>
          </fieldset>

          {(formError || error) && (
            <p className="status error" role="alert">
              {formError || error}
            </p>
          )}

          <footer className="modal-footer">
            <button type="button" className="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

