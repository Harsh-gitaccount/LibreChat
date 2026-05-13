const { logger } = require('@librechat/data-schemas');
const Contact = require('~/models/Contact');

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

const CONTACT_SIGNAL_WORDS = new Set([
  'contact', 'contacts', 'who', 'works', 'company', 'email', 'role',
  'cto', 'ceo', 'cfo', 'coo', 'cmo', 'engineer', 'developer', 'designer',
  'engineers', 'developers', 'designers',
  'founder', 'director', 'manager', 'president', 'vp', 'lead', 'head',
  'person', 'people', 'team', 'colleague', 'partner', 'client',
  'hired', 'employee', 'staff', 'hire', 'hiring',
  'know', 'about', 'tell',
]);

let contactCountCache = null;
let contactCountCacheExpiry = 0;

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
  const words = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  return words.find((w) => roleKeywords.includes(w)) || null;
}

function isContactRelated(message) {
  const lower = message.toLowerCase();
  const words = lower.split(/\s+/);
  for (const word of words) {
    const cleaned = word.replace(/[^a-z]/g, '');
    if (cleaned && CONTACT_SIGNAL_WORDS.has(cleaned)) {
      return true;
    }
  }
  if (/(?:know\s+about|tell\s+me\s+about|works?\s+at|who\s+is)/i.test(message)) {
    return true;
  }
  return false;
}

async function hasContacts(userId) {
  const now = Date.now();
  if (contactCountCache !== null && now < contactCountCacheExpiry) {
    return contactCountCache > 0;
  }
  try {
    const idToSearch = typeof userId === 'object' ? userId.id || userId._id : userId;
    contactCountCache = await Contact.countDocuments({ user: idToSearch }).limit(1);
    contactCountCacheExpiry = now + 60000;
    return contactCountCache > 0;
  } catch (err) {
    logger.warn('[contactRetrieval] Error checking contact count:', err);
    return false;
  }
}

async function retrieveRelevantContacts(userMessage, userId) {
  if (!isContactRelated(userMessage)) {
    const userHasContacts = await hasContacts(userId);
    if (!userHasContacts) {
      return { contacts: [], contextBlock: '' };
    }
  }

  const keywords = extractKeywords(userMessage);
  const detectedCompany = extractCompany(userMessage);
  const detectedRole = extractRole(userMessage);

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
    // If it is contact related but no specific keywords were found (e.g. 'show me my contacts')
    // we should just return the top 20 most recent contacts instead of failing.
    const idToSearch = typeof userId === 'object' ? userId.id || userId._id : userId;
    const recentContacts = await Contact.find({ user: idToSearch }).sort({ created_at: -1 }).limit(20);
    if (recentContacts.length === 0) {
      return { contacts: [], contextBlock: '' };
    }
    const contactStrings = recentContacts.map((c, i) => `${i + 1}. ${c.toPromptString()}`);
    const contextBlock = [
      '[CONTACTS CONTEXT]',
      'The following contacts from the user\'s workspace are available:',
      '',
      ...contactStrings,
      '',
      'Use this information to answer the user\'s question accurately. Only reference contacts listed above.',
      '[END CONTACTS CONTEXT]',
    ].join('\n');
    return { contacts: recentContacts, contextBlock };
  }

  const idToSearch = typeof userId === 'object' ? userId.id || userId._id : userId;
  const filter = { user: idToSearch };
  if (conditions.length === 1) {
    Object.assign(filter, conditions[0]);
  } else {
    filter.$or = conditions;
  }

  const hasTextSearch = conditions.some((c) => c.$text);
  const projection = hasTextSearch ? { score: { $meta: 'textScore' } } : {};
  const sort = hasTextSearch ? { score: { $meta: 'textScore' } } : { created_at: -1 };

  const contacts = await Contact.find(filter, projection).sort(sort).limit(20);

  if (contacts.length === 0) {
    return { contacts: [], contextBlock: '' };
  }

  const contactStrings = contacts.map((c, i) => `${i + 1}. ${c.toPromptString()}`);

  const contextBlock = [
    '[CONTACTS CONTEXT]',
    'The following contacts from the user\'s workspace are relevant to this query:',
    '',
    ...contactStrings,
    '',
    'Use this information to answer the user\'s question accurately. Only reference contacts listed above. If no contacts above are relevant, say so honestly.',
    '[END CONTACTS CONTEXT]',
  ].join('\n');

  return { contacts, contextBlock };
}

module.exports = {
  extractKeywords,
  extractCompany,
  extractRole,
  isContactRelated,
  retrieveRelevantContacts,
};
