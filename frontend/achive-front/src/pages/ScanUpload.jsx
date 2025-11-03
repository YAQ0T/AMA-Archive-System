import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../services/api'
import { useArchiveContext } from '../context/ArchiveContext'
import { MONTHS } from '../constants/archive'

const ARCHIVE_PERIODS = ['Monthly', 'Quarterly', 'Yearly', 'Indefinite']
const SCAN_MODES = ['Color', 'Gray', 'Lineart']
const SCAN_RESOLUTIONS = ['150', '200', '300', '600']

const createEmptyTag = () => ({ name: '', price: '', archivePeriod: ARCHIVE_PERIODS[0] })
const createDefaultScanOptions = () => ({
  device: '',
  mode: SCAN_MODES[0],
  resolution: SCAN_RESOLUTIONS.includes('300') ? '300' : SCAN_RESOLUTIONS[0],
})

export const ScanUpload = () => {
  const { refresh } = useArchiveContext()
  const [activeTab, setActiveTab] = useState('upload')
  const [file, setFile] = useState(null)
  const [tags, setTags] = useState([createEmptyTag()])
  const [notes, setNotes] = useState('')
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [merchant, setMerchant] = useState('')
  const [month, setMonth] = useState(() => MONTHS[new Date().getMonth()] ?? MONTHS[0])
  const [progress, setProgress] = useState(null)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [scanOptions, setScanOptions] = useState(() => createDefaultScanOptions())
  const [availableScanners, setAvailableScanners] = useState([])
  const [scannerDiscovery, setScannerDiscovery] = useState({ type: 'idle', message: '' })

  const fetchScanners = useCallback(async () => {
    setScannerDiscovery({ type: 'loading', message: 'Searching for scanners…' })

    try {
      const payload = await api.listScanners()
      const scanners = Array.isArray(payload?.scanners) ? payload.scanners : []

      setAvailableScanners(scanners)
      setScannerDiscovery({
        type: 'success',
        message:
          payload?.summary ||
          (scanners.length
            ? `Found ${scanners.length} scanner${scanners.length === 1 ? '' : 's'} via scanimage.`
            : 'No scanners were reported by scanimage. Ensure each device is powered on and reachable.'),
      })
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Unable to query scanners. Check that the backend server can run scanimage -L.'

      setScannerDiscovery({ type: 'error', message })
      setAvailableScanners([])
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'scan') {
      return
    }

    fetchScanners()
  }, [activeTab, fetchScanners])

  useEffect(() => {
    if (scanOptions.device || availableScanners.length !== 1) {
      return
    }

    setScanOptions((current) => ({ ...current, device: availableScanners[0].id }))
  }, [availableScanners, scanOptions.device])

  const hasInvalidTag = useMemo(
    () => tags.some((tag) => !tag.name || tag.price === '' || !tag.archivePeriod),
    [tags],
  )

  const invalidMetadata = useMemo(() => {
    const trimmedMerchant = merchant.trim()
    return !year || !trimmedMerchant || !month
  }, [year, merchant, month])

  const isUploadDisabled = useMemo(
    () => invalidMetadata || hasInvalidTag || !file || status.type === 'loading',
    [invalidMetadata, hasInvalidTag, file, status.type],
  )

  const isScanDisabled = useMemo(
    () => invalidMetadata || hasInvalidTag || status.type === 'loading',
    [invalidMetadata, hasInvalidTag, status.type],
  )

  const resetMetadata = () => {
    setTags([createEmptyTag()])
    setNotes('')
    setYear(() => String(new Date().getFullYear()))
    setMerchant('')
    setMonth(() => MONTHS[new Date().getMonth()] ?? MONTHS[0])
  }

  const resetScanOptions = () => {
    setScanOptions(createDefaultScanOptions())
  }

  const handleModeChange = (tab) => {
    if (tab === activeTab) {
      return
    }
    setActiveTab(tab)
    setStatus({ type: 'idle', message: '' })
    setProgress(null)
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
            archivePeriod: tag.archivePeriod,
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
      resetScanOptions()
      refresh()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Upload failed. Please try again.'
      setStatus({ type: 'error', message })
      setProgress(null)
    }
  }

  const submitScan = async () => {
    if (isScanDisabled) {
      setStatus({ type: 'error', message: 'Please complete all metadata fields before scanning.' })
      return
    }

    const trimmedMerchant = merchant.trim()
    const numericYear = Number(year)
    if (!Number.isFinite(numericYear) || !trimmedMerchant || !month) {
      setStatus({ type: 'error', message: 'Please provide a valid year, merchant name, and month.' })
      return
    }

    setProgress(null)
    setStatus({ type: 'loading', message: 'Scanning document…' })

    try {
      const payload = {
        notes,
        tags: tags.map((tag) => ({
          name: tag.name,
          price: Number(tag.price),
          archivePeriod: tag.archivePeriod,
        })),
        year: numericYear,
        merchant: trimmedMerchant,
        month,
      }

      const trimmedDevice = scanOptions.device.trim()
      if (trimmedDevice) {
        payload.device = trimmedDevice
      }
      if (scanOptions.mode) {
        payload.mode = scanOptions.mode
      }
      if (scanOptions.resolution) {
        payload.resolution = Number(scanOptions.resolution)
      }

      await api.scanDocument(payload)

      setStatus({ type: 'success', message: 'Document scanned and stored successfully.' })
      resetMetadata()
      resetScanOptions()
      setFile(null)
      refresh()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Scan failed. Please try again.'
      setStatus({ type: 'error', message })
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (activeTab === 'upload') {
      await submitUpload()
    } else {
      await submitScan()
    }
  }

  return (
    <section className="card">
      <h2>Scan / Upload Document</h2>
      <p className="section-description">
        {activeTab === 'upload'
          ? 'Upload new documents, assign pricing, archive periods, and searchable tags. Progress updates will appear as your file uploads.'
          : 'Trigger a connected scanner to capture a document, apply metadata, and automatically archive the resulting PDF.'}
      </p>

      <div className="mode-toggle" role="tablist" aria-label="Document intake mode">
        <button
          type="button"
          role="tab"
          className={activeTab === 'upload' ? 'active' : ''}
          aria-selected={activeTab === 'upload'}
          onClick={() => handleModeChange('upload')}
        >
          Upload file
        </button>
        <button
          type="button"
          role="tab"
          className={activeTab === 'scan' ? 'active' : ''}
          aria-selected={activeTab === 'scan'}
          onClick={() => handleModeChange('scan')}
        >
          Scan with device
        </button>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
        {activeTab === 'upload' ? (
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
        ) : (
          <fieldset className="scan-options-fieldset">
            <legend>Scanner configuration</legend>
            <p className="hint">
              Provide optional scanner overrides. Leave these fields blank to use the default device settings
              configured on the server running <code>scanimage</code>.
            </p>
            <div className="scanner-discovery">
              <p
                className={`hint${
                  scannerDiscovery.type === 'error' ? ' error' : scannerDiscovery.type === 'success' ? ' success' : ''
                }`}
              >
                {scannerDiscovery.message || 'Scanner discovery has not been run yet.'}
              </p>
              <button
                type="button"
                onClick={fetchScanners}
                disabled={scannerDiscovery.type === 'loading'}
                className="secondary"
              >
                {scannerDiscovery.type === 'loading' ? 'Refreshing…' : 'Refresh devices'}
              </button>
            </div>
            <div className="scan-options-grid">
              <div className="field">
                <label htmlFor="scan-device">Device name</label>
                <input
                  id="scan-device"
                  type="text"
                  value={scanOptions.device}
                  onChange={(event) => setScanOptions((current) => ({ ...current, device: event.target.value }))}
                  placeholder="e.g. epkowa:usb:001:002"
                  list="scan-device-options"
                />
                <datalist id="scan-device-options">
                  {availableScanners.map((scanner) => (
                    <option key={scanner.id} value={scanner.id}>
                      {scanner.label}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label htmlFor="scan-mode">Scan mode</label>
                <select
                  id="scan-mode"
                  value={scanOptions.mode}
                  onChange={(event) => setScanOptions((current) => ({ ...current, mode: event.target.value }))}
                >
                  {SCAN_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="scan-resolution">Resolution (DPI)</label>
                <select
                  id="scan-resolution"
                  value={scanOptions.resolution}
                  onChange={(event) => setScanOptions((current) => ({ ...current, resolution: event.target.value }))}
                >
                  <option value="">System default</option>
                  {SCAN_RESOLUTIONS.map((dpi) => (
                    <option key={dpi} value={dpi}>
                      {dpi}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <details className="scanner-instructions">
              <summary>How to prepare network scanners</summary>
              <p className="hint">
                The archive service relies on the SANE <code>scanimage</code> utility. To discover network scanners:
              </p>
              <ol>
                <li>Ensure the scanner is powered on and connected to the same network as the backend server.</li>
                <li>Install and configure the appropriate SANE backend for your model (for example, <code>airscan</code> or
                  vendor-specific drivers).</li>
                <li>On the backend host, run <code>scanimage -L</code> to confirm the device appears in the list.</li>
                <li>Return here and choose the detected identifier from the list above, or type it manually.</li>
              </ol>
            </details>
          </fieldset>
        )}

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

        {progress !== null && (
          <div className="progress">
            <div className="progress-track" aria-hidden>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span>{progress}%</span>
          </div>
        )}

        <button
          type="submit"
          className="primary"
          disabled={activeTab === 'upload' ? isUploadDisabled : isScanDisabled}
        >
          {activeTab === 'upload' ? 'Upload document' : 'Scan document'}
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
