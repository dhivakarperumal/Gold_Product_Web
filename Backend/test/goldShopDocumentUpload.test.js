const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  MAX_FILE_SIZE_BYTES,
  resolveGoldShopDocumentPath,
  validateGoldShopDocumentSignature
} = require('../src/middleware/goldShopDocumentUpload');

test('resolves only generated gold shop document keys inside private storage', () => {
  const filePath = resolveGoldShopDocumentPath('123e4567-e89b-12d3-a456-426614174000.pdf');
  assert.ok(filePath);
  assert.equal(path.basename(filePath), '123e4567-e89b-12d3-a456-426614174000.pdf');
  assert.equal(resolveGoldShopDocumentPath('../secret.pdf'), null);
  assert.equal(resolveGoldShopDocumentPath('not-a-uuid.exe'), null);
  assert.equal(MAX_FILE_SIZE_BYTES, 5 * 1024 * 1024);
});

test('checks uploaded document content signatures against declared MIME types', async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gold-shop-documents-'));
  try {
    const pdfPath = path.join(directory, 'document.pdf');
    const pngPath = path.join(directory, 'document.png');
    const jpegPath = path.join(directory, 'document.jpg');
    await fs.promises.writeFile(pdfPath, '%PDF-1.7');
    await fs.promises.writeFile(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    await fs.promises.writeFile(jpegPath, Buffer.from([0xff, 0xd8, 0xff, 0x00]));

    assert.equal(validateGoldShopDocumentSignature(pdfPath, 'application/pdf'), true);
    assert.equal(validateGoldShopDocumentSignature(pngPath, 'image/png'), true);
    assert.equal(validateGoldShopDocumentSignature(jpegPath, 'image/jpeg'), true);
    assert.equal(validateGoldShopDocumentSignature(pdfPath, 'image/png'), false);
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
