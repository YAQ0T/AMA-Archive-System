require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, query, param, validationResult } = require('express-validator');

const DocumentModel = require('./models/document');

const { MONTHS } = DocumentModel;

const Document = DocumentModel;

const app = express();

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Environment variable MONGO_URI is required to start the service.');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Archive backend listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  });

const uploadsDir = process.env.UPLOAD_DIR
  ? path.isAbsolute(process.env.UPLOAD_DIR)
    ? process.env.UPLOAD_DIR
    : path.join(__dirname, process.env.UPLOAD_DIR)
  : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
    const uniqueName = `${timestamp}-${safeName}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed.'));
    }
  },
});

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file) {
      fs.promises
        .unlink(req.file.path)
        .catch(() => {});
    }
    return res.status(422).json({ errors: errors.array() });
  }
  next();
};

const parseTags = (value, { req }) => {
  if (value === undefined || value === null || value === '') {
    req.parsedTags = [];
    return true;
  }

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      throw new Error('Tags must be valid JSON.');
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Tags must be an array.');
  }

  parsed.forEach((tag, index) => {
    if (typeof tag !== 'object' || tag === null) {
      throw new Error(`Tag at position ${index} must be an object.`);
    }
    if (!tag.name || typeof tag.name !== 'string' || !tag.name.trim()) {
      throw new Error(`Tag at position ${index} must include a name.`);
    }
    if (tag.price === undefined || Number.isNaN(Number(tag.price))) {
      throw new Error(`Tag at position ${index} must include a numeric price.`);
    }
  });

  req.parsedTags = parsed.map((tag) => ({
    name: tag.name.trim(),
    price: Number(tag.price),
  }));

  return true;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

app.post(
  '/api/documents',
  upload.single('file'),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  body('tags').optional().custom(parseTags),
  body('year')
    .exists()
    .withMessage('Year is required.')
    .bail()
    .isInt({ min: 1900, max: 9999 })
    .toInt(),
  body('merchant')
    .exists()
    .withMessage('Merchant name is required.')
    .bail()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Merchant name must be between 1 and 200 characters.'),
  body('month')
    .exists()
    .withMessage('Month is required.')
    .bail()
    .isString()
    .trim()
    .bail()
    .isIn(MONTHS)
    .withMessage(`Month must be one of: ${MONTHS.join(', ')}`),
  handleValidation,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'A document file is required.' });
      }

      const document = await Document.create({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        storagePath: path.relative(__dirname, req.file.path),
        mimeType: req.file.mimetype,
        size: req.file.size,
        tags: req.parsedTags || [],
        notes: req.body.notes,
        year: Number(req.body.year),
        merchantName: req.body.merchant.trim(),
        month: req.body.month,
      });

      return res.status(201).json(document);
    } catch (error) {
      if (req.file) {
        fs.promises
          .unlink(req.file.path)
          .catch(() => {});
      }
      next(error);
    }
  }
);

app.get(
  '/api/documents',
  [
    query('name').optional().isString(),
    query('price').optional().isFloat(),
    query('year').optional().isInt({ min: 1900, max: 9999 }),
    query('merchant').optional().isString(),
    query('month').optional().isIn(MONTHS),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('skip').optional().isInt({ min: 0 }),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const { name, price, year, merchant, month, limit = 50, skip = 0 } = req.query;

      const filters = {};

      if (name) {
        const regex = new RegExp(name, 'i');
        filters.$or = [
          { originalName: regex },
          { 'tags.name': regex },
          { merchantName: regex },
        ];
      }
      if (price) {
        filters['tags.price'] = Number(price);
      }
      if (year) {
        filters.year = Number(year);
      }
      if (merchant) {
        filters.merchantName = new RegExp(`^${escapeRegExp(merchant)}$`, 'i');
      }
      if (month) {
        filters.month = new RegExp(`^${escapeRegExp(month)}$`, 'i');
      }

      const documents = await Document.find(filters)
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit));

      res.json(documents);
    } catch (error) {
      next(error);
    }
  }
);

app.get('/api/documents/hierarchy', async (_req, res, next) => {
  try {
    const records = await Document.find({}, { year: 1, merchantName: 1, month: 1, _id: 0 }).lean();

    const monthOrder = new Map(MONTHS.map((value, index) => [value, index]));
    const tree = new Map();

    records.forEach(({ year, merchantName, month }) => {
      if (year === undefined || merchantName === undefined || month === undefined) {
        return;
      }
      const safeYear = Number(year);
      if (!tree.has(safeYear)) {
        tree.set(safeYear, new Map());
      }
      const merchantKey = merchantName.trim();
      const merchants = tree.get(safeYear);
      if (!merchants.has(merchantKey)) {
        merchants.set(merchantKey, new Set());
      }
      merchants.get(merchantKey).add(month);
    });

    const years = Array.from(tree.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([yearValue, merchantsMap]) => ({
        year: yearValue,
        merchants: Array.from(merchantsMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([merchantName, monthsSet]) => ({
            name: merchantName,
            months: Array.from(monthsSet.values()).sort(
              (a, b) => (monthOrder.get(a) ?? 0) - (monthOrder.get(b) ?? 0)
            ),
          })),
      }));

    res.json({ years });
  } catch (error) {
    next(error);
  }
});

app.get(
  '/api/documents/:id',
  [param('id').isMongoId()],
  handleValidation,
  async (req, res, next) => {
    try {
      const document = await Document.findById(req.params.id);
      if (!document) {
        return res.status(404).json({ message: 'Document not found.' });
      }
      res.json(document);
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  '/api/documents/:id/file',
  [param('id').isMongoId()],
  handleValidation,
  async (req, res, next) => {
    try {
      const document = await Document.findById(req.params.id);
      if (!document) {
        return res.status(404).json({ message: 'Document not found.' });
      }

      const absolutePath = path.resolve(__dirname, document.storagePath);
      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ message: 'Stored file not found on server.' });
      }

      res.type(document.mimeType);
      res.sendFile(absolutePath);
    } catch (error) {
      next(error);
    }
  }
);

app.patch(
  '/api/documents/:id',
  [
    param('id').isMongoId(),
    body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
    body('tags').optional().custom(parseTags),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const updates = {};

      if (req.body.notes !== undefined) {
        updates.notes = req.body.notes;
      }

      if (req.parsedTags !== undefined) {
        updates.tags = req.parsedTags;
      }

      const document = await Document.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      });

      if (!document) {
        return res.status(404).json({ message: 'Document not found.' });
      }

      res.json(document);
    } catch (error) {
      next(error);
    }
  }
);

app.use((req, res, next) => {
  res.status(404).json({ message: 'Endpoint not found.' });
});

app.use((err, req, res, _next) => {
  console.error(err);

  if (req.file) {
    fs.promises
      .unlink(req.file.path)
      .catch(() => {});
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Internal Server Error',
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception', error);
});
