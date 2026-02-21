import { useEffect, useMemo, useState } from 'react'
import { INVOICE_TYPES, MONTHS } from '../constants/archive'
import { normaliseAmountInput, parseAmountInput, resolveDocumentAmount } from '../utils/amount'

export const DocumentEditor = ({ open, document, onClose, onSubmit, saving, error }) => {
  const [notes, setNotes] = useState('')
  const [year, setYear] = useState('')
  const [merchant, setMerchant] = useState('')
  const [month, setMonth] = useState(() => MONTHS[new Date().getMonth()] ?? MONTHS[0])
  const [invoiceType, setInvoiceType] = useState('sales')
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!open || !document) {
      return
    }

    setNotes(document.notes ?? '')
    setYear(document.year ? String(document.year) : '')
    setMerchant(document.merchantName ?? '')
    setMonth(document.month && MONTHS.includes(document.month) ? document.month : MONTHS[0])

    const initialInvoiceType =
      INVOICE_TYPES.some((type) => type.value === document.invoiceType) ? document.invoiceType : 'sales'
    setInvoiceType(initialInvoiceType)

    const directAmount = Number(document.amount)
    const resolvedAmount = Number.isFinite(directAmount) && directAmount >= 0 ? directAmount : resolveDocumentAmount(document)
    setAmount(resolvedAmount > 0 ? String(resolvedAmount) : '')

    setFormError('')
  }, [document, open])

  useEffect(() => {
    if (!open) {
      setFormError('')
    }
  }, [open])

  const monthOptions = useMemo(() => MONTHS, [])

  const handleSubmit = (event) => {
    event.preventDefault()
    setFormError('')

    const trimmedMerchant = merchant.trim()
    const numericYear = Number(year)
    const numericAmount = parseAmountInput(amount, { defaultValue: 0 })

    if (!Number.isFinite(numericYear) || numericYear < 1900 || numericYear > 9999) {
      setFormError('Please provide a valid year between 1900 and 9999.')
      return
    }

    if (!trimmedMerchant) {
      setFormError('Customer name is required.')
      return
    }

    if (!monthOptions.includes(month)) {
      setFormError('Please select a valid month.')
      return
    }

    if (!invoiceType) {
      setFormError('Please select a valid invoice type.')
      return
    }

    if (Number.isNaN(numericAmount)) {
      setFormError('Please provide a valid amount value.')
      return
    }

    onSubmit({
      notes,
      amount: numericAmount,
      invoiceType,
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
              Update document metadata including customer name, invoice type, and amount.
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
              <label htmlFor="editor-merchant">اسم الزبون</label>
              <input
                id="editor-merchant"
                type="text"
                value={merchant}
                onChange={(event) => setMerchant(event.target.value)}
                placeholder="مثال: مؤسسة الأمل"
                dir="auto"
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
            <div className="field">
              <label htmlFor="editor-invoice-type">نوع الفاتورة</label>
              <select
                id="editor-invoice-type"
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
              <label htmlFor="editor-amount">المبلغ (Amount)</label>
              <input
                id="editor-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(normaliseAmountInput(event.target.value))}
                placeholder="0"
                dir="ltr"
              />
              <p className="hint">Arabic digits are converted to English automatically.</p>
            </div>
          </div>

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
