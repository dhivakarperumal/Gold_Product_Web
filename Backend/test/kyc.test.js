const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { canReadKycDocument, normalizeReviewReason, parseDocumentTypes, toCustomerApplication, validDate } = require('../src/controllers/kycController');
const { pool } = require('../src/config/db');
const {
  canResubmitKycStatus,
  canReviewKycStatus,
  getAllowedDocumentTypes,
  getKycApplicationById,
  getKycDocument,
  getKycStats,
  listKycApplications,
  reviewKycApplication
} = require('../src/modules/kycModule');
const { validateKycFileSignature } = require('../src/middleware/kycUpload');

test('accepts configured supported document types and rejects malformed lists', () => {
  const previous = process.env.KYC_ALLOWED_DOCUMENT_TYPES;
  process.env.KYC_ALLOWED_DOCUMENT_TYPES = 'passport,pan';
  try {
    assert.deepEqual(parseDocumentTypes('["passport","pan"]', 2), ['passport', 'pan']);
    assert.equal(parseDocumentTypes('["ration_card"]', 1), null);
    assert.equal(parseDocumentTypes('["passport"]', 2), null);
    assert.equal(parseDocumentTypes('not json', 1), null);
  } finally {
    if (previous === undefined) delete process.env.KYC_ALLOWED_DOCUMENT_TYPES;
    else process.env.KYC_ALLOWED_DOCUMENT_TYPES = previous;
  }
});

test('requires an explicit document allowlist and rejects unapproved types', () => {
  const previous = process.env.KYC_ALLOWED_DOCUMENT_TYPES;
  try {
    process.env.KYC_ALLOWED_DOCUMENT_TYPES = '';
    assert.deepEqual(getAllowedDocumentTypes(), []);
    process.env.KYC_ALLOWED_DOCUMENT_TYPES = 'unknown_id';
    assert.throws(() => getAllowedDocumentTypes(), /Unsupported KYC document types/);
  } finally {
    if (previous === undefined) delete process.env.KYC_ALLOWED_DOCUMENT_TYPES;
    else process.env.KYC_ALLOWED_DOCUMENT_TYPES = previous;
  }
});

test('validates exact review eligibility and resubmission statuses', () => {
  assert.equal(canReviewKycStatus('pending'), true);
  assert.equal(canReviewKycStatus('in_review'), true);
  assert.equal(canReviewKycStatus('verified'), false);
  assert.equal(canResubmitKycStatus('rejected'), true);
  assert.equal(canResubmitKycStatus('resubmission_required'), true);
  assert.equal(canResubmitKycStatus('failed'), true);
  assert.equal(canResubmitKycStatus('verified'), false);
});

test('enforces private-document ownership except for authorized admins', () => {
  const document = { user_id: 17 };
  assert.equal(canReadKycDocument(document, 17, false), true);
  assert.equal(canReadKycDocument(document, '17', false), true);
  assert.equal(canReadKycDocument(document, 18, false), false);
  assert.equal(canReadKycDocument(document, undefined, true), true);
  assert.equal(canReadKycDocument({ ...document, applicant_created_by: 'admin-a' }, undefined, true, 'admin-a'), true);
  assert.equal(canReadKycDocument({ ...document, applicant_created_by: 'admin-b' }, undefined, true, 'admin-a'), false);
});

test('scopes KYC lists and statistics to customers created by the requesting admin', async (context) => {
  const originalExecute = pool.execute;
  const queries = [];
  pool.execute = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.includes('GROUP BY a.status')) return [[{ status: 'pending', total: 1 }]];
    if (sql.includes('COUNT(*) AS total')) return [[{ total: 1 }]];
    return [[{ id: 1 }]];
  };
  context.after(() => { pool.execute = originalExecute; });

  const ownerUserId = 'admin-a';
  await listKycApplications({
    page: 1,
    pageSize: 20,
    status: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    ownerUserId
  });
  const stats = await getKycStats({ ownerUserId });

  assert.equal(queries.length, 3);
  for (const query of queries) {
    assert.match(query.sql, /EXISTS \(SELECT 1 FROM loan_customers lc/);
    assert.match(query.sql, /lc\.created_by = \?/);
    assert.equal(query.values[0], ownerUserId);
  }
  assert.equal(stats.pending, 1);
});

test('scopes KYC detail and review queries to the requesting admin', async (context) => {
  const originalExecute = pool.execute;
  const originalGetConnection = pool.getConnection;
  const queries = [];
  pool.execute = async (sql, values) => {
    queries.push({ sql, values });
    return [[]];
  };
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('SELECT a.id, a.status')) return [[{ id: 12, status: 'pending' }]];
      return [{ affectedRows: 1 }];
    }
  };
  pool.getConnection = async () => connection;
  context.after(() => {
    pool.execute = originalExecute;
    pool.getConnection = originalGetConnection;
  });

  const ownerUserId = 'admin-a';
  assert.equal(await getKycApplicationById(12, ownerUserId), null);
  await reviewKycApplication({
    applicationId: 12,
    reviewerId: 3,
    decision: 'verified',
    reason: '',
    ownerUserId
  });

  const ownerQueries = queries.filter(({ sql }) => sql.includes('EXISTS (SELECT 1 FROM loan_customers lc'));
  assert.equal(ownerQueries.length, 3);
  for (const query of ownerQueries) {
    assert.match(query.sql, /lc\.created_by = \?/);
    assert.equal(query.values.at(-1), ownerUserId);
  }
});

test('loads the creator identity needed to authorize KYC document access', async (context) => {
  const originalExecute = pool.execute;
  let query = '';
  pool.execute = async (sql) => {
    query = sql;
    return [[{ id: 8, applicant_created_by: 'admin-a' }]];
  };
  context.after(() => { pool.execute = originalExecute; });

  const document = await getKycDocument(8);

  assert.match(query, /LEFT JOIN loan_customers lc ON lc\.user_id = a\.user_id/);
  assert.match(query, /lc\.created_by AS applicant_created_by/);
  assert.equal(document.applicant_created_by, 'admin-a');
});

test('returns only customer-safe application fields', () => {
  const result = toCustomerApplication({
    id: 8,
    user_id: 17,
    reviewer_id: 2,
    applicant_email: 'private@example.com',
    status: 'pending',
    documents: []
  });
  assert.deepEqual(Object.keys(result), [
    'id', 'status', 'provider', 'consent_version', 'consented_at',
    'reviewed_at', 'review_reason', 'created_at', 'updated_at', 'documents'
  ]);
});

test('validates document signatures instead of trusting the filename or MIME metadata', async (context) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kyc-signature-'));
  context.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const pdfPath = path.join(directory, 'document.bin');
  await fs.promises.writeFile(pdfPath, Buffer.from('%PDF-1.7\n'));
  assert.equal(validateKycFileSignature(pdfPath, 'application/pdf'), true);
  assert.equal(validateKycFileSignature(pdfPath, 'image/png'), false);
  await fs.promises.writeFile(pdfPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  assert.equal(validateKycFileSignature(pdfPath, 'image/png'), true);
  await fs.promises.writeFile(pdfPath, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  assert.equal(validateKycFileSignature(pdfPath, 'image/jpeg'), true);
  await fs.promises.writeFile(pdfPath, Buffer.from('not a PDF'));
  assert.equal(validateKycFileSignature(pdfPath, 'application/pdf'), false);
});

test('validates review reason and calendar dates', () => {
  assert.equal(normalizeReviewReason('  Please upload a clearer copy.  '), 'Please upload a clearer copy.');
  assert.equal(normalizeReviewReason({}), null);
  assert.equal(normalizeReviewReason('x'.repeat(2500)).length, 2000);
  assert.equal(validDate('2026-10-17'), '2026-10-17');
  assert.equal(validDate('2026-02-31'), undefined);
  assert.equal(validDate('17-10-2026'), undefined);
});
