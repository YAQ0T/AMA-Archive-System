export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const INVOICE_TYPES = [
  { value: 'sales', label: 'مبيعات' },
  { value: 'purchases', label: 'مشتريات' },
  { value: 'tax_invoice', label: 'فاتورة ضريبية' },
];

export const INVOICE_TYPE_LABELS = INVOICE_TYPES.reduce((accumulator, type) => {
  accumulator[type.value] = type.label;
  return accumulator;
}, {});
