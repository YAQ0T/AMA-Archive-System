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
