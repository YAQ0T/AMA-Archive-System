const mongoose = require('mongoose');

const MONTHS = [
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

const INVOICE_TYPES = ['sales', 'purchases', 'tax_invoice'];

const TagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const DocumentSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    storedName: {
      type: String,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    tags: {
      type: [TagSchema],
      default: [],
    },
    amount: {
      type: Number,
      min: 0,
      default: 0,
    },
    invoiceType: {
      type: String,
      enum: INVOICE_TYPES,
      default: 'sales',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    year: {
      type: Number,
      required: true,
      min: 1900,
      max: 9999,
    },
    merchantName: {
      type: String,
      required: true,
      trim: true,
    },
    month: {
      type: String,
      required: true,
      enum: MONTHS,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Document', DocumentSchema);
module.exports.MONTHS = MONTHS;
module.exports.INVOICE_TYPES = INVOICE_TYPES;
