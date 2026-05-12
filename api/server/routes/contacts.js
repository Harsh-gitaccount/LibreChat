const fs = require('fs');
const express = require('express');
const csv = require('csv-parser');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const upload = require('~/server/middleware/upload');
const Contact = require('~/models/Contact');

const router = express.Router();
router.use(requireJwtAuth);

const CORE_FIELDS = new Set(['name', 'company', 'role', 'email', 'notes']);

/**
 * Aliases map non-standard CSV column names to our core contact fields.
 * This allows seamless import of CSVs with varying schemas (e.g. 'company_name' → 'company').
 */
const FIELD_ALIASES = {
  company_name: 'company',
  organization: 'company',
  org: 'company',
  designation: 'role',
  job_title: 'role',
  title: 'role',
  position: 'role',
  note: 'notes',
};

/** Columns that represent parts of a full name and should be combined. */
const NAME_PARTS = new Set(['first_name', 'middle_name', 'last_name']);

function mapRowToContact(row, userId) {
  const contact = { attributes: new Map(), user: userId };
  const nameParts = {};

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, '_');
    if (!value || String(value).trim() === '') {
      continue;
    }
    const trimmedValue = String(value).trim();

    // Assemble split name columns (first_name, middle_name, last_name)
    if (NAME_PARTS.has(normalizedKey)) {
      nameParts[normalizedKey] = trimmedValue;
      continue;
    }

    // Rename CSV 'id' to 'original_id' to avoid MongoDB _id collision
    if (normalizedKey === 'id') {
      contact.attributes.set('original_id', trimmedValue);
      continue;
    }

    // Resolve aliases (e.g. company_name → company, designation → role)
    const resolvedKey = FIELD_ALIASES[normalizedKey] || normalizedKey;

    if (CORE_FIELDS.has(resolvedKey)) {
      contact[resolvedKey] = trimmedValue;
    } else if (resolvedKey === 'tags') {
      contact.tags = trimmedValue
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    } else {
      contact.attributes.set(normalizedKey, trimmedValue);
    }
  }

  // If no direct 'name' column was found, build it from name parts
  if (!contact.name && Object.keys(nameParts).length > 0) {
    const assembled = [
      nameParts.first_name,
      nameParts.middle_name,
      nameParts.last_name,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (assembled) {
      contact.name = assembled;
    }
  }

  // Populate the denormalized search field with all attribute values for high-performance text indexing
  if (contact.attributes.size > 0) {
    contact.searchable_attributes = Array.from(contact.attributes.values()).join(' ');
  }

  return contact;
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;
    const { search, company, role, tag } = req.query;
    const userId = req.user.id;

    const filter = { user: userId };

    if (company) {
      filter.company = { $regex: company, $options: 'i' };
    }
    if (role) {
      filter.role = { $regex: role, $options: 'i' };
    }
    if (search) {
      // Use $regex for partial typeahead UI search instead of strict $text whole-word search
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { name: searchRegex },
        { company: searchRegex },
        { role: searchRegex },
        { email: searchRegex },
        { searchable_attributes: searchRegex },
      ];
    }
    if (tag) {
      filter.tags = tag;
    }

    const sortOption = { created_at: -1 };
    const projection = {};

    const [contacts, total] = await Promise.all([
      Contact.find(filter, projection).sort(sortOption).skip(skip).limit(limit).lean(),
      Contact.countDocuments(filter),
    ]);

    res.json({
      contacts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('[Contacts] Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

router.get('/search/query', async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user.id;

    if (!q || String(q).trim().length === 0) {
      return res.json({ contacts: [], query: q, keywords: [] });
    }

    const query = String(q);
    const keywords = extractKeywords(query);
    const detectedCompany = extractCompany(query);
    const detectedRole = extractRole(query);

    const conditions = [];

    if (keywords.length > 0) {
      conditions.push({ $text: { $search: keywords.join(' ') } });
    }
    if (detectedCompany) {
      conditions.push({ company: { $regex: detectedCompany, $options: 'i' } });
    }
    if (detectedRole) {
      conditions.push({ role: { $regex: detectedRole, $options: 'i' } });
    }

    if (conditions.length === 0) {
      return res.json({ contacts: [], query, keywords });
    }

    const filter = { user: userId };
    if (conditions.length === 1) {
      Object.assign(filter, conditions[0]);
    } else {
      filter.$or = conditions;
    }

    const hasTextSearch = conditions.some((c) => c.$text);
    const projection = hasTextSearch ? { score: { $meta: 'textScore' } } : {};
    const sort = hasTextSearch ? { score: { $meta: 'textScore' } } : { created_at: -1 };

    const contacts = await Contact.find(filter, projection).sort(sort).limit(20).lean();

    res.json({ contacts, query, keywords });
  } catch (error) {
    logger.error('[Contacts] Error in search query:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/companies', async (req, res) => {
  try {
    const userId = req.user.id;
    const companies = await Contact.distinct('company', {
      user: userId,
      company: { $ne: '' },
    });
    res.json({ companies: companies.sort() });
  } catch (error) {
    logger.error('[Contacts] Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const contact = await Contact.findOne({ _id: req.params.id, user: userId });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    logger.error('[Contacts] Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, company, role, email, notes, tags, attributes } = req.body;

    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const contactData = {
      name: String(name).trim(),
      company: company ? String(company).trim() : '',
      role: role ? String(role).trim() : '',
      email: email ? String(email).trim() : '',
      notes: notes ? String(notes).trim() : '',
      tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()) : [],
      user: userId,
    };

    if (attributes && typeof attributes === 'object') {
      contactData.attributes = new Map(Object.entries(attributes));
      contactData.searchable_attributes = Object.values(attributes)
        .filter((v) => v !== null && v !== '')
        .join(' ');
    }

    const contact = await Contact.create(contactData);
    res.status(201).json(contact);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'A contact with this email already exists' });
    }
    logger.error('[Contacts] Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, company, role, email, notes, tags, attributes } = req.body;

    const contact = await Contact.findOne({ _id: req.params.id, user: userId });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (name !== undefined) {
      contact.name = String(name).trim();
    }
    if (company !== undefined) {
      contact.company = String(company).trim();
    }
    if (role !== undefined) {
      contact.role = String(role).trim();
    }
    if (email !== undefined) {
      contact.email = String(email).trim();
    }
    if (notes !== undefined) {
      contact.notes = String(notes).trim();
    }
    if (tags !== undefined) {
      contact.tags = Array.isArray(tags)
        ? tags.filter((t) => typeof t === 'string' && t.trim())
        : [];
    }

    if (attributes && typeof attributes === 'object') {
      for (const [key, value] of Object.entries(attributes)) {
        if (value === null || value === '') {
          contact.attributes.delete(key);
        } else {
          contact.attributes.set(key, String(value));
        }
      }
      contact.searchable_attributes = Array.from(contact.attributes.values()).join(' ');
    }

    await contact.save();
    res.json(contact);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'A contact with this email already exists' });
    }
    logger.error('[Contacts] Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await Contact.deleteOne({ _id: req.params.id, user: userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('[Contacts] Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }

  const filePath = req.file.path;
  const userId = req.user.id;
  let imported = 0;
  let failed = 0;
  const errors = [];
  let batch = [];
  let rowNumber = 0;

  const processBatch = async (rows) => {
    if (rows.length === 0) {
      return;
    }
    const ops = rows.map((doc) => ({
      insertOne: { document: doc },
    }));
    try {
      const result = await Contact.bulkWrite(ops, { ordered: false });
      imported += result.insertedCount;
    } catch (bulkError) {
      if (bulkError.insertedCount !== undefined) {
        imported += bulkError.insertedCount;
      }
      const writeErrors = bulkError.writeErrors || [];
      for (const writeErr of writeErrors) {
        failed++;
        if (errors.length < 10) {
          errors.push({
            row: writeErr.index + rowNumber - rows.length,
            message: writeErr.errmsg || writeErr.message || 'Unknown error',
          });
        }
      }
    }
  };

  try {
    const stream = fs.createReadStream(filePath).pipe(csv());

    for await (const row of stream) {
      rowNumber++;
      const contact = mapRowToContact(row, userId);
      
      if (!contact.name) {
        failed++;
        if (errors.length < 10) {
          errors.push({ row: rowNumber, message: 'Missing required field: name' });
        }
        continue;
      }
      
      batch.push(contact);
      
      if (batch.length >= 500) {
        await processBatch(batch);
        batch = [];
      }
    }

    // Process any remaining contacts in the final batch
    if (batch.length > 0) {
      await processBatch(batch);
      batch = [];
    }

    res.json({
      imported,
      failed,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    logger.error('[Contacts] Error importing CSV:', error);
    res.status(500).json({
      error: 'Import failed',
      imported,
      failed,
      errors: errors.slice(0, 10),
    });
  } finally {
    fs.unlink(filePath, (err) => {
      if (err) {
        logger.warn('[Contacts] Failed to clean up temp file:', err);
      }
    });
  }
});

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'who', 'what', 'which', 'where', 'when',
  'how', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'will', 'shall',
  'at', 'in', 'of', 'on', 'to', 'for', 'with', 'about', 'from', 'by', 'as', 'or', 'and',
  'tell', 'me', 'us', 'our', 'list', 'all', 'show', 'find', 'get', 'know', 'works',
  'work', 'working', 'based', 'looking', 'interested', 'contacts', 'contact',
  'any', 'have', 'has', 'been', 'being', 'this', 'that', 'these', 'those',
  'not', 'but', 'if', 'then', 'than', 'more', 'most', 'some', 'such',
  'no', 'nor', 'only', 'own', 'same', 'so', 'very', 'just',
]);

function extractKeywords(query) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function extractCompany(query) {
  const match = query.match(
    /(?:at|from|in|for)\s+([A-Z][a-zA-Z0-9\s&.,-]{1,40}?)(?:\?|$|\s+(?:who|what|how|list|that|which))/i,
  );
  return match ? match[1].trim() : null;
}

function extractRole(query) {
  const roleKeywords = [
    'cto', 'ceo', 'cfo', 'coo', 'cmo', 'cio', 'vp', 'director', 'manager',
    'engineer', 'developer', 'designer', 'founder', 'president', 'lead',
    'head', 'officer', 'analyst', 'consultant', 'architect', 'partner',
  ];
  const words = query.toLowerCase().split(/\s+/);
  return words.find((w) => roleKeywords.includes(w)) || null;
}

module.exports = router;
