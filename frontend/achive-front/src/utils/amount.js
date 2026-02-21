const EASTERN_ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

const toEnglishDigits = (value) =>
  String(value)
    .replace(/[٠-٩]/g, (digit) => String(EASTERN_ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))

export const normaliseAmountInput = (value) =>
  toEnglishDigits(value)
    .replace(/[٫]/g, '.')
    .replace(/[٬،]/g, ',')
    .replace(/[^0-9.,]/g, '')

export const parseAmountInput = (value, { defaultValue = 0 } = {}) => {
  const normalised = normaliseAmountInput(value).replace(/,/g, '').trim()

  if (!normalised) {
    return defaultValue
  }

  const numeric = Number(normalised)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return Number.NaN
  }

  return numeric
}

export const resolveDocumentAmount = (document) => {
  const directAmount = Number(document?.amount)
  if (Number.isFinite(directAmount) && directAmount >= 0) {
    return directAmount
  }

  const fallbackFromTags = (document?.tags || []).reduce((sum, tag) => sum + Number(tag?.price || 0), 0)
  if (Number.isFinite(fallbackFromTags) && fallbackFromTags >= 0) {
    return fallbackFromTags
  }

  return 0
}
