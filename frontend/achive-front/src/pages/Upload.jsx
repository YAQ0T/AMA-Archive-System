import { useMemo, useState } from 'react'
import { api, ApiError } from '../services/api'
import { useArchiveContext } from '../context/ArchiveContext'
import { MONTHS } from '../constants/archive'

const createEmptyTag = () => ({ name: '', price: '' })

export const Upload = () => {
  const { refresh } = useArchiveContext()
  const [file, setFile] = useState(null)
  const [tags, setTags] = useState([createEmptyTag()])
  const [notes, setNotes] = useState('')
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [merchant, setMerchant] = useState('')
  const [month, setMonth] = useState(() => MONTHS[new Date().getMonth()] ?? MONTHS[0])
  const [progress, setProgress] = useState(null)
  const [status, setStatus] = useState({ type: 'idle', message: '' })

  const hasInvalidTag = useMemo(() => tags.some((tag) => !tag.name || tag.price === ''), [tags])

  const invalidMetadata = useMemo(() => {
    const trimmedMerchant = merchant.trim()
    return !year || !trimmedMerchant || !month
  }, [year, merchant, month])

  const isUploadDisabled = useMemo(
    () => invalidMetadata || hasInvalidTag || !file || status.type === 'loading',
    [invalidMetadata, hasInvalidTag, file, status.type],
  )

  const resetMetadata = () => {
    setTags([createEmptyTag()])
    setNotes('')
    setYear(() => String(new Date().getFullYear()))
    setMerchant('')
    setMonth(() => MONTHS[new Date().getMonth()] ?? MONTHS[0])
  }

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0]
    if (!selected) {
      setFile(null)
      return
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (!allowedTypes.includes(selected.type)) {
      setStatus({ type: 'error', message: 'Only PDF and Word documents are allowed.' })
      setFile(null)
      event.target.value = ''
      return
    }

    setFile(selected)
    setProgress(null)
    setStatus({ type: 'idle', message: '' })
  }

  const updateTag = (index, patch) => {
    setTags((current) => current.map((tag, tagIndex) => (tagIndex === index ? { ...tag, ...patch } : tag)))
  }

  const addTag = () => {
    setTags((current) => [...current, createEmptyTag()])
  }

  const removeTag = (index) => {
    setTags((current) => current.filter((_, tagIndex) => tagIndex !== index))
  }

  const submitUpload = async () => {
    if (isUploadDisabled) {
      setStatus({ type: 'error', message: 'Please select a file and complete all metadata fields.' })
      return
    }

    const trimmedMerchant = merchant.trim()
    const numericYear = Number(year)
    if (!Number.isFinite(numericYear) || !trimmedMerchant || !month) {
      setStatus({ type: 'error', message: 'Please provide a valid year, merchant name, and month.' })
      return
    }

    setProgress(0)
    setStatus({ type: 'loading', message: 'Uploading document…' })

    try {
      await api.uploadDocument(
        {
          file,
          notes,
          tags: tags.map((tag) => ({
            name: tag.name,
            price: Number(tag.price),
          })),
          year: numericYear,
          merchant: trimmedMerchant,
          month,
        },
        {
          onProgress: (percent) => {
            setProgress(percent)
          },
        },
      )

      setStatus({ type: 'success', message: 'Document uploaded successfully.' })
      setProgress(100)
      setFile(null)
      resetMetadata()
      refresh()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Upload failed. Please try again.'
      setStatus({ type: 'error', message })
      setProgress(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await submitUpload()
  }

  return (
    <section className="card">
      <h2>Upload Document</h2>
      <p className="section-description">
        Upload new documents, assign pricing, and add searchable tags. Progress updates will appear as your file uploads.
      </p>

      <form className="upload-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="document-file">Document file</label>
          <input
            id="document-file"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
          />
          {file && <p className="hint">Selected: {file.name}</p>}
        </div>

        <div className="field">
          <label htmlFor="document-notes">Notes (optional)</label>
          <textarea
            id="document-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Describe this document for your team…"
          />
        </div>

        <div className="upload-metadata-grid">
          <div className="field">
            <label htmlFor="document-year">Year</label>
            <input
              id="document-year"
              type="number"
              min="1900"
              max="9999"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="document-merchant">Merchant</label>
            <input
              id="document-merchant"
              type="text"
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              placeholder="e.g. ACME Trading Co."
              required
            />
          </div>
          <div className="field">
            <label htmlFor="document-month">Month</label>
            <select
              id="document-month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              required
            >
              {MONTHS.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="tags-fieldset">
          <legend>Metadata tags</legend>
          <p className="hint">Provide at least one tag to describe pricing and search keywords.</p>
          {tags.map((tag, index) => (
            <div key={index} className="tag-row">
              <div className="field">
                <label htmlFor={`tag-name-${index}`}>Name</label>
                <input
                  id={`tag-name-${index}`}
                  type="text"
                  required
                  value={tag.name}
                  onChange={(event) => updateTag(index, { name: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`tag-price-${index}`}>Price</label>
                <input
                  id={`tag-price-${index}`}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={tag.price}
                  onChange={(event) => updateTag(index, { price: event.target.value })}
                />
              </div>
              {tags.length > 1 && (
                <button type="button" className="ghost" onClick={() => removeTag(index)}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" className="secondary" onClick={addTag}>
            Add another tag
          </button>
        </fieldset>

        {progress !== null && (
          <div className="progress">
            <div className="progress-track" aria-hidden>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span>{progress}%</span>
          </div>
        )}

        <button type="submit" className="primary" disabled={isUploadDisabled}>
          Upload document
        </button>
      </form>

      {status.message && (
        <p className={`status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
          {status.message}
        </p>
      )}
    </section>
  )
}
