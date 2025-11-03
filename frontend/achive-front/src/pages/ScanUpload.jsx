import { useMemo, useState } from 'react'
import { api, ApiError } from '../services/api'
import { useArchiveContext } from '../context/ArchiveContext'

const ARCHIVE_PERIODS = ['Monthly', 'Quarterly', 'Yearly', 'Indefinite']

const createEmptyTag = () => ({ name: '', price: '', archivePeriod: ARCHIVE_PERIODS[0] })

export const ScanUpload = () => {
  const { refresh } = useArchiveContext()
  const [file, setFile] = useState(null)
  const [tags, setTags] = useState([createEmptyTag()])
  const [notes, setNotes] = useState('')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState({ type: 'idle', message: '' })

  const isSubmitDisabled = useMemo(() => {
    const hasInvalidTag = tags.some((tag) => !tag.name || tag.price === '' || !tag.archivePeriod)
    return !file || hasInvalidTag
  }, [file, tags])

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

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitDisabled) {
      setStatus({ type: 'error', message: 'Please select a file and complete all metadata fields.' })
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
            archivePeriod: tag.archivePeriod,
          })),
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
      setTags([createEmptyTag()])
      setNotes('')
      refresh()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Upload failed. Please try again.'
      setStatus({ type: 'error', message })
    }
  }

  return (
    <section className="card">
      <h2>Scan / Upload Document</h2>
      <p className="section-description">
        Upload new documents, assign pricing, archive periods, and searchable tags. Progress updates will
        appear as your file uploads.
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

        <fieldset className="tags-fieldset">
          <legend>Metadata tags</legend>
          <p className="hint">Provide at least one tag to describe pricing and archive requirements.</p>
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
              <div className="field">
                <label htmlFor={`tag-archive-${index}`}>Archive period</label>
                <select
                  id={`tag-archive-${index}`}
                  value={tag.archivePeriod}
                  onChange={(event) => updateTag(index, { archivePeriod: event.target.value })}
                >
                  {ARCHIVE_PERIODS.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
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

        <div className="progress">
          <div className="progress-track" aria-hidden>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}%</span>
        </div>

        <button type="submit" className="primary" disabled={isSubmitDisabled}>
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

