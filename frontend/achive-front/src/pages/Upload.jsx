import { useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../services/api'
import { useArchiveContext } from '../context/ArchiveContext'
import { INVOICE_TYPES, MONTHS } from '../constants/archive'
import { normaliseAmountInput, parseAmountInput } from '../utils/amount'

export const Upload = () => {
  const { refresh, hierarchy } = useArchiveContext()
  const [files, setFiles] = useState([])
  const [notes, setNotes] = useState('')
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [merchant, setMerchant] = useState('')
  const [month, setMonth] = useState(() => MONTHS[new Date().getMonth()] ?? MONTHS[0])
  const [amount, setAmount] = useState('')
  const [invoiceType, setInvoiceType] = useState('sales')
  const [progress, setProgress] = useState(null)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const fileInputRef = useRef(null)

  const merchantOptions = useMemo(() => {
    const years = hierarchy?.years ?? []
    const names = new Set()

    years.forEach((yearEntry) => {
      const merchants = yearEntry?.merchants ?? []
      merchants.forEach((merchantEntry) => {
        const name = merchantEntry?.name?.trim()
        if (name) {
          names.add(name)
        }
      })
    })

    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ar'))
  }, [hierarchy])

  const parsedAmount = useMemo(() => parseAmountInput(amount, { defaultValue: 0 }), [amount])
  const hasInvalidAmount = Number.isNaN(parsedAmount)

  const invalidMetadata = useMemo(() => {
    const trimmedMerchant = merchant.trim()
    return !year || !trimmedMerchant || !month || !invoiceType
  }, [year, merchant, month, invoiceType])

  const isUploadDisabled = useMemo(
    () => invalidMetadata || hasInvalidAmount || files.length === 0 || status.type === 'loading',
    [invalidMetadata, hasInvalidAmount, files.length, status.type],
  )

  const resetMetadata = () => {
    setFiles([])
    setNotes('')
    setYear(() => String(new Date().getFullYear()))
    setMerchant('')
    setMonth(() => MONTHS[new Date().getMonth()] ?? MONTHS[0])
    setAmount('')
    setInvoiceType('sales')
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
    const numericAmount = parseAmountInput(amount, { defaultValue: 0 })

    if (!Number.isFinite(numericYear) || !trimmedMerchant || !month || !invoiceType) {
      setStatus({ type: 'error', message: 'Please provide a valid year, customer name, month, and invoice type.' })
      return
    }

    if (Number.isNaN(numericAmount)) {
      setStatus({ type: 'error', message: 'Amount must be a valid number.' })
      return
    }

    setProgress(0)
    setStatus({ type: 'loading', message: 'Uploading documents…' })

    try {
      await api.uploadDocument(
        {
          files,
          notes,
          amount: numericAmount,
          invoiceType,
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
        Upload documents with customer name, invoice type, and amount. Amount defaults to 0 when left empty.
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
          {files.length > 0 && <p className="hint">Selected: {files.map((file) => file.name).join(', ')}</p>}
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
            <label htmlFor="document-merchant">اسم الزبون</label>
            <input
              id="document-merchant"
              type="text"
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              list={merchantOptions.length > 0 ? 'document-merchant-options' : undefined}
              placeholder="مثال: مؤسسة الأمل"
              dir="auto"
              required
            />
            {merchantOptions.length > 0 && (
              <datalist id="document-merchant-options">
                {merchantOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            )}
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

          <div className="field">
            <label htmlFor="document-invoice-type">نوع الفاتورة</label>
            <select
              id="document-invoice-type"
              value={invoiceType}
              onChange={(event) => setInvoiceType(event.target.value)}
              required
            >
              {INVOICE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="document-amount">المبلغ (Amount)</label>
            <input
              id="document-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(normaliseAmountInput(event.target.value))}
              placeholder="0"
              dir="ltr"
            />
            <p className="hint">Arabic digits are converted to English automatically.</p>
            {hasInvalidAmount && <p className="hint warning">Please enter a valid amount.</p>}
          </div>
        </div>

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
