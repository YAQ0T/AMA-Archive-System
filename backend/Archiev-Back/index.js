require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
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
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Only PDF, Word, or image files (JPEG, PNG) are allowed.');
      error.status = 400;
      cb(error);
    }
  },
});

const cleanupUploadedFiles = (files = []) => {
  if (!Array.isArray(files) || files.length === 0) {
    return Promise.resolve();
  }

  return Promise.allSettled(
    files.map((file) => fs.promises.unlink(file.path).catch(() => {}))
  ).then(() => {});
};

const handleValidation = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const uploadedFiles = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
    await cleanupUploadedFiles(uploadedFiles);
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

const sanitizeNameSegment = (value, { fallback } = {}) => {
  if (!value) {
    return fallback;
  }

  const normalised = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalised || fallback;
};

const sanitizeDirectoryName = (value, { fallback = 'unknown' } = {}) =>
  sanitizeNameSegment(value, { fallback });

const sanitizeFileBaseName = (value, { fallback = 'document' } = {}) =>
  sanitizeNameSegment(value, { fallback });

const deriveStoredFileName = ({
  currentStoredName,
  merchantName,
  month,
  year,
  fallbackPath,
}) => {
  const ensureTimestampPrefix = (value) => {
    if (typeof value !== 'string' || !value.trim()) {
      return String(Date.now());
    }

    const hyphenIndex = value.indexOf('-');
    if (hyphenIndex > 0) {
      return value.slice(0, hyphenIndex);
    }

    const digitsMatch = value.match(/^\d+/);
    if (digitsMatch) {
      return digitsMatch[0];
    }

    return String(Date.now());
  };

  const extension =
    path.extname(currentStoredName || '') || path.extname(fallbackPath || '') || '';
  const timestampPrefix = ensureTimestampPrefix(currentStoredName);
  const segments = [
    sanitizeFileBaseName(merchantName, { fallback: 'merchant' }),
    sanitizeFileBaseName(month, { fallback: 'month' }),
    sanitizeFileBaseName(year !== undefined && year !== null ? String(year) : '', {
      fallback: 'year',
    }),
  ].filter(Boolean);

  const baseName = segments.join('-') ||
    sanitizeFileBaseName(path.parse(currentStoredName || '').name, { fallback: 'document' });

  return `${timestampPrefix}-${baseName}${extension}`;
};

const isImageMimeType = (mimetype) => typeof mimetype === 'string' && mimetype.startsWith('image/');

const createPdfFromImages = async (files, { nameHint } = {}) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('At least one image file is required to create a PDF.');
  }

  const firstOriginalName = files[0]?.originalname || '';
  const baseName = sanitizeFileBaseName(nameHint || path.parse(firstOriginalName).name, {
    fallback: 'document',
  });

  const uniqueName = `${Date.now()}-${baseName}.pdf`;
  const pdfPath = path.join(uploadsDir, uniqueName);

  const pdfDocument = new PDFDocument({ autoFirstPage: false, margin: 0 });
  const writeStream = fs.createWriteStream(pdfPath);

  const completion = new Promise((resolve, reject) => {
    const rejectOnce = (error) => {
      writeStream.destroy();
      reject(error);
    };

    writeStream.on('finish', resolve);
    writeStream.on('error', rejectOnce);
    pdfDocument.on('error', rejectOnce);
  });

  pdfDocument.pipe(writeStream);

  let pdfFinalised = false;

  try {
    for (const file of files) {
      const image = pdfDocument.openImage(file.path);
      const width = image.width || image.originalWidth || image.size?.width || 595.28; // default A4 width in pt
      const height =
        image.height || image.originalHeight || image.size?.height || 841.89; // default A4 height

      pdfDocument.addPage({ size: [width, height] });
      pdfDocument.image(image, 0, 0, { width, height });
    }

    pdfDocument.end();
    pdfFinalised = true;
    await completion;
  } catch (error) {
    try {
      if (!pdfFinalised) {
        pdfDocument.end();
      }
    } catch (endError) {
      console.error('Failed to finalise PDF document after error', endError);
    }

    await new Promise((resolve) => writeStream.once('close', resolve)).catch(() => {});
    await fs.promises.unlink(pdfPath).catch(() => {});
    throw error;
  }

  const stats = await fs.promises.stat(pdfPath);

  return {
    path: pdfPath,
    filename: uniqueName,
    mimetype: 'application/pdf',
    size: stats.size,
    originalname: `${baseName}.pdf`,
  };
};

const normaliseUploadedFiles = async (files, { nameHint } = {}) => {
  if (!Array.isArray(files) || files.length === 0) {
    return { files: [], generated: [] };
  }

  const areAllImages = files.every((file) => isImageMimeType(file.mimetype));

  if (areAllImages) {
    const combinedPdf = await createPdfFromImages(files, { nameHint });
    await cleanupUploadedFiles(files);
    return { files: [combinedPdf], generated: [combinedPdf] };
  }

  const hasImage = files.some((file) => isImageMimeType(file.mimetype));

  if (hasImage) {
    throw Object.assign(new Error('Mixing image files with other document types in a single upload is not supported.'), {
      status: 400,
    });
  }

  return { files, generated: [] };
};

const moveDocumentToHierarchy = async ({ filePath, year, merchantName, month }) => {
  const yearSegment = String(year ?? '')
    .replace(/[^0-9]/g, '')
    .trim();

  if (!yearSegment) {
    throw new Error('Invalid year received for document storage.');
  }

  const merchantSegment = sanitizeDirectoryName(merchantName, { fallback: 'merchant' });
  const monthSegment = sanitizeDirectoryName(month, { fallback: 'month' });

  const targetDirectory = path.join(uploadsDir, yearSegment, merchantSegment, monthSegment);
  await fs.promises.mkdir(targetDirectory, { recursive: true });

  const fileName = path.basename(filePath);
  const destination = path.join(targetDirectory, fileName);

  if (destination !== filePath) {
    await fs.promises.rename(filePath, destination);
  }

  return destination;
};

app.post(
  '/api/documents',
  upload.array('files', 20),
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
      const uploadedFiles = Array.isArray(req.files) ? req.files : [];

      let files = [];
      let generated = [];

      if (uploadedFiles.length === 0) {
        return res.status(400).json({ message: 'At least one document file is required.' });
      }

      const yearValue = Number(req.body.year);
      const merchantValue = req.body.merchant.trim();
      const monthValue = req.body.month;

      const nameHintParts = [merchantValue, monthValue, yearValue].filter(Boolean);
      const normalisedFiles = await normaliseUploadedFiles(uploadedFiles, {
        nameHint: nameHintParts.join('-') || undefined,
      });
      files = Array.isArray(normalisedFiles.files) ? normalisedFiles.files : [];
      generated = Array.isArray(normalisedFiles.generated) ? normalisedFiles.generated : [];

      const documents = [];

      for (const file of files) {
        const hierarchicalPath = await moveDocumentToHierarchy({
          filePath: file.path,
          year: yearValue,
          merchantName: merchantValue,
          month: monthValue,
        });

        file.path = hierarchicalPath;

        const relativeStoragePath = path
          .relative(__dirname, hierarchicalPath)
          .split(path.sep)
          .join('/');

        const document = await Document.create({
          originalName: file.originalname,
          storedName: file.filename,
          storagePath: relativeStoragePath,
          mimeType: file.mimetype,
          size: file.size,
          tags: req.parsedTags || [],
          notes: req.body.notes,
          year: yearValue,
          merchantName: merchantValue,
          month: monthValue,
        });

        documents.push(document);
      }

      return res.status(201).json({ documents });
    } catch (error) {
      const uploadedFiles = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
      await cleanupUploadedFiles([...uploadedFiles, ...generated]);
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
    const records = await Document.find(
      {},
      {
        year: 1,
        merchantName: 1,
        month: 1,
        originalName: 1,
        storedName: 1,
        storagePath: 1,
        mimeType: 1,
        size: 1,
        notes: 1,
        tags: 1,
        createdAt: 1,
        updatedAt: 1,
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    const monthOrder = new Map(MONTHS.map((value, index) => [value, index]));
    const tree = new Map();

    records.forEach((record) => {
      const { year, merchantName, month } = record;
      if (year === undefined || merchantName === undefined || month === undefined) {
        return;
      }

      const safeYear = Number(year);
      if (!Number.isFinite(safeYear)) {
        return;
      }

      const merchantKey = merchantName.trim();
      if (!merchantKey) {
        return;
      }

      if (!tree.has(safeYear)) {
        tree.set(safeYear, new Map());
      }

      const merchants = tree.get(safeYear);

      if (!merchants.has(merchantKey)) {
        merchants.set(merchantKey, new Map());
      }

      const months = merchants.get(merchantKey);

      if (!months.has(month)) {
        months.set(month, []);
      }

      const documents = months.get(month);
      const createdAt = record.createdAt || record.updatedAt || null;
      const updatedAt = record.updatedAt || record.createdAt || null;
      documents.push({
        id: String(record._id),
        originalName: record.originalName,
        storedName: record.storedName,
        storagePath: record.storagePath,
        mimeType: record.mimeType,
        size: record.size,
        notes: record.notes,
        tags: record.tags || [],
        createdAt,
        updatedAt,
      });
    });

    const years = Array.from(tree.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([yearValue, merchantsMap]) => ({
        year: yearValue,
        merchants: Array.from(merchantsMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([merchantName, monthsMap]) => ({
            name: merchantName,
            months: Array.from(monthsMap.entries())
              .sort(
                (a, b) => (monthOrder.get(a[0]) ?? 0) - (monthOrder.get(b[0]) ?? 0)
              )
              .map(([monthName, documents]) => ({
                name: monthName,
                documents: documents.sort((a, b) => {
                  const aTime = new Date(a.createdAt || 0).getTime();
                  const bTime = new Date(b.createdAt || 0).getTime();
                  return bTime - aTime;
                }),
              })),
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
    body('year')
      .optional({ nullable: true })
      .isInt({ min: 1900, max: 9999 })
      .toInt(),
    body('merchant')
      .optional({ nullable: true })
      .isString()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Merchant name must be between 1 and 200 characters.'),
    body('month')
      .optional({ nullable: true })
      .isString()
      .trim()
      .isIn(MONTHS)
      .withMessage(`Month must be one of: ${MONTHS.join(', ')}`),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const document = await Document.findById(req.params.id);

      if (!document) {
        return res.status(404).json({ message: 'Document not found.' });
      }

      const originalYear = document.year;
      const originalMerchant = document.merchantName;
      const originalMonth = document.month;
      const originalAbsolutePath = path.resolve(__dirname, document.storagePath);

      const nextYear =
        req.body.year !== undefined && req.body.year !== null ? Number(req.body.year) : originalYear;
      const nextMerchant =
        req.body.merchant !== undefined && req.body.merchant !== null
          ? req.body.merchant.trim()
          : originalMerchant;
      const nextMonth =
        req.body.month !== undefined && req.body.month !== null ? req.body.month : originalMonth;

      const shouldRelocate =
        (nextYear !== undefined && nextYear !== originalYear) ||
        (nextMerchant !== undefined && nextMerchant !== originalMerchant) ||
        (nextMonth !== undefined && nextMonth !== originalMonth);

      if (req.body.notes !== undefined) {
        document.notes = req.body.notes;
      }

      if (req.parsedTags !== undefined) {
        document.tags = req.parsedTags;
      }

      if (req.body.year !== undefined && req.body.year !== null) {
        document.year = nextYear;
      }

      if (req.body.merchant !== undefined && req.body.merchant !== null) {
        document.merchantName = nextMerchant;
      }

      if (req.body.month !== undefined && req.body.month !== null) {
        document.month = nextMonth;
      }

      let relocationResult = null;

      if (shouldRelocate) {
        let relocatedPath = null;
        let finalAbsolutePath = null;

        try {
          relocatedPath = await moveDocumentToHierarchy({
            filePath: originalAbsolutePath,
            year: nextYear,
            merchantName: nextMerchant,
            month: nextMonth,
          });

          const nextStoredName = deriveStoredFileName({
            currentStoredName: document.storedName,
            merchantName: nextMerchant,
            month: nextMonth,
            year: nextYear,
            fallbackPath: relocatedPath,
          });

          const desiredPath = path.join(path.dirname(relocatedPath), nextStoredName);
          finalAbsolutePath = relocatedPath;

          if (desiredPath !== relocatedPath) {
            await fs.promises.rename(relocatedPath, desiredPath);
            finalAbsolutePath = desiredPath;
          }

          relocationResult = {
            originalAbsolutePath,
            relocatedAbsolutePath: finalAbsolutePath,
          };

          const relativeStoragePath = path
            .relative(__dirname, finalAbsolutePath)
            .split(path.sep)
            .join('/');
          document.storagePath = relativeStoragePath;
          document.storedName = nextStoredName;
        } catch (error) {
          const currentLocation = finalAbsolutePath || relocatedPath;
          if (currentLocation && currentLocation !== originalAbsolutePath) {
            try {
              await fs.promises.mkdir(path.dirname(originalAbsolutePath), { recursive: true });
              await fs.promises.rename(currentLocation, originalAbsolutePath);
            } catch (restoreError) {
              console.error('Failed to restore document after relocation error', restoreError);
            }
          }
          return next(error);
        }
      }

      try {
        await document.save();
      } catch (error) {
        if (relocationResult) {
          const { originalAbsolutePath: originalPath, relocatedAbsolutePath: relocatedPath } = relocationResult;
          try {
            await fs.promises.mkdir(path.dirname(originalPath), { recursive: true });
            await fs.promises.rename(relocatedPath, originalPath);
          } catch (restoreError) {
            console.error('Failed to restore document after update error', restoreError);
          }
        }
        throw error;
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

  const uploadedFiles = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
  cleanupUploadedFiles(uploadedFiles);

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
