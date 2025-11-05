import { useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../services/api'
import { useArchiveContext } from '../context/ArchiveContext'
import { MONTHS } from '../constants/archive'

const QUICK_TAG_PRESETS = [
  { label: 'Cash', name: 'Cash' },
  { label: 'Checks', name: 'Checks' },
]

const createTag = (name = '') => ({ name, price: '' })
const createInitialTags = () => []

export const Upload = () => {
  const { refresh } = useArchiveContext()
  const [files, setFiles] = useState([])
  const [tags, setTags] = useState(() => createInitialTags())
  const [notes, setNotes] = useState('')
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [merchant, setMerchant] = useState('')
  const [month, setMonth] = useState(() => MONTHS[new Date().getMonth()] ?? MONTHS[0])
  const [progress, setProgress] = useState(null)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const fileInputRef = useRef(null)

  const normalizedTags = useMemo(
    () =>
      tags
        .map((tag) => ({
          name: tag.name.trim(),
          price: tag.price,
        }))
        .filter((tag) => tag.name !== '' || tag.price !== ''),
    [tags],
  )

  const hasInvalidTag = useMemo(
    () =>
      normalizedTags.some((tag) => {
        if (tag.name === '' || tag.price === '') {
          return true
        }

        const numericPrice = Number(tag.price)
        return Number.isNaN(numericPrice) || numericPrice < 0
      }),
    [normalizedTags],
  )

  const invalidMetadata = useMemo(() => {
    const trimmedMerchant = merchant.trim()
    return !year || !trimmedMerchant || !month
  }, [year, merchant, month])

  const isUploadDisabled = useMemo(
    () => invalidMetadata || hasInvalidTag || files.length === 0 || status.type === 'loading',
    [invalidMetadata, hasInvalidTag, files.length, status.type],
  )

  const resetMetadata = () => {
    setFiles([])
    setTags(createInitialTags())
    setNotes('')
    setYear(() => String(new Date().getFullYear()))
    setMerchant('')
    setMonth(() => MONTHS[new Date().getMonth()] ?? MONTHS[0])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files ?? [])

    if (!selectedFiles.length) {
      setFiles([])
      return
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ]

    const invalidFiles = selectedFiles.filter((file) => !allowedTypes.includes(file.type))

    if (invalidFiles.length > 0) {
      setStatus({
        type: 'error',
        message: 'Only PDF, Word, or image files (JPEG, PNG) are allowed.',
      })
      setFiles([])
      if (event.target) {
        event.target.value = ''
      }
      return
    }

    setFiles(selectedFiles)
    setProgress(null)
    setStatus({ type: 'idle', message: '' })
  }

  const updateTag = (index, patch) => {
    setTags((current) => current.map((tag, tagIndex) => (tagIndex === index ? { ...tag, ...patch } : tag)))
  }

  const addTag = () => {
    setTags((current) => [...current, createTag()])
  }

  const addQuickTag = (preset) => {
    setTags((current) => [...current, createTag(preset.name)])
  }

  const removeTag = (index) => {
    setTags((current) => current.filter((_, tagIndex) => tagIndex !== index))
  }

  const submitUpload = async () => {
    if (isUploadDisabled) {
      setStatus({
        type: 'error',
        message: 'Please select at least one file and complete the required fields.',
      })
      return
    }

    const trimmedMerchant = merchant.trim()
    const numericYear = Number(year)
    if (!Number.isFinite(numericYear) || !trimmedMerchant || !month) {
      setStatus({ type: 'error', message: 'Please provide a valid year, merchant name, and month.' })
      return
    }

    setProgress(0)
    setStatus({ type: 'loading', message: 'Uploading documents…' })

    try {
      await api.uploadDocument(
        {
          files,
          notes,
          tags: normalizedTags.map((tag) => ({
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

      setStatus({ type: 'success', message: 'Documents uploaded successfully.' })
      setProgress(100)
      resetMetadata()
      refresh()
      setTimeout(() => {
        setProgress(null)
      }, 300)
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
          <label htmlFor="document-file">Document files</label>
          <input
            id="document-file"
            type="file"
            ref={fileInputRef}
            multiple
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
            onChange={handleFileChange}
          />
          {files.length > 0 && (
            <p className="hint">Selected: {files.map((file) => file.name).join(', ')}</p>
          )}
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
          <legend>Metadata tags (optional)</legend>
          <p className="hint">Add pricing or keyword tags if you need them. You can leave this empty.</p>
          <div className="tags-quick-actions" aria-label="Quick tag options">
            {QUICK_TAG_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="ghost"
                onClick={() => addQuickTag(preset)}
              >
                {preset.label}
              </button>
            ))}
            <button type="button" className="ghost quick-add" onClick={addTag} aria-label="Add custom tag">
              +
            </button>
          </div>
          {tags.length === 0 && (
            <p className="hint">No metadata tags added.</p>
          )}
          {tags.map((tag, index) => (
            <div key={index} className="tag-row">
              <div className="field">
                <label htmlFor={`tag-name-${index}`}>Name</label>
                <input
                  id={`tag-name-${index}`}
                  type="text"
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
                  value={tag.price}
                  onChange={(event) => updateTag(index, { price: event.target.value })}
                />
                {tag.price !== '' && Number(tag.price) === 0 && (
                  <p className="hint warning" role="alert">Price is currently set to 0.</p>
                )}
              </div>
              <button type="button" className="ghost" onClick={() => removeTag(index)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="secondary" onClick={addTag}>
            Add tag
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
