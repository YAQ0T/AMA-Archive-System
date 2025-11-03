const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const PDFDocument = require('pdfkit');

const fsPromises = fs.promises;

const buildScanArgs = ({ device, mode, resolution }) => {
  const args = ['--format=png'];

  if (device) {
    args.push(`--device-name=${device}`);
  }

  if (mode) {
    args.push(`--mode=${mode}`);
  }

  if (resolution) {
    args.push(`--resolution=${resolution}`);
  }

  return args;
};

const runScanimage = (options = {}) =>
  new Promise((resolve, reject) => {
    const args = buildScanArgs(options);
    const scanner = spawn('scanimage', args);
    const chunks = [];
    let stderr = '';

    scanner.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    scanner.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    scanner.on('error', (error) => {
      reject(error);
    });

    scanner.on('close', (code) => {
      if (code !== 0) {
        const error = new Error(
          stderr.trim() || `scanimage exited with code ${code}`
        );
        error.code = code;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve(Buffer.concat(chunks));
    });
  });

const convertPngBufferToPdf = async (buffer) => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'scan-'));
  const pngPath = path.join(tmpDir, `${randomUUID()}.png`);
  const pdfPath = path.join(tmpDir, `${randomUUID()}.pdf`);

  try {
    await fsPromises.writeFile(pngPath, buffer);

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ autoFirstPage: false });
      const writeStream = fs.createWriteStream(pdfPath);
      doc.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);

      doc.pipe(writeStream);

      const image = doc.openImage(pngPath);
      doc.addPage({ size: [image.width, image.height] });
      doc.image(image, 0, 0);

      doc.end();
    });

    const pdfBuffer = await fsPromises.readFile(pdfPath);
    return pdfBuffer;
  } finally {
    await fsPromises.rm(tmpDir, { recursive: true, force: true });
  }
};

const scanToPdf = async (options = {}) => {
  const pngBuffer = await runScanimage(options);
  const pdfBuffer = await convertPngBufferToPdf(pngBuffer);
  return {
    pdfBuffer,
  };
};

module.exports = {
  scanToPdf,
};
