const {
  extractKeywords,
  extractCompany,
  extractRole,
  isContactRelated,
} = require('./contactRetrieval');

describe('contactRetrieval', () => {
  describe('extractKeywords', () => {
    it('removes stop words and returns meaningful keywords', () => {
      const result = extractKeywords('Who works at Acme Corp?');
      expect(result).toContain('acme');
      expect(result).toContain('corp');
      expect(result).not.toContain('who');
      expect(result).not.toContain('at');
    });

    it('handles empty string', () => {
      expect(extractKeywords('')).toEqual([]);
    });

    it('removes special characters', () => {
      const result = extractKeywords('What about john@acme.com?');
      expect(result).toContain('john');
      expect(result).toContain('acme');
      expect(result).toContain('com');
    });
  });

  describe('extractCompany', () => {
    it('detects company from "at [Company]"', () => {
      expect(extractCompany('Who works at Acme Corp?')).toBe('Acme Corp');
    });

    it('detects company from "from [Company]"', () => {
      expect(extractCompany('contacts from Stripe')).toBe('Stripe');
    });

    it('returns null when no company pattern matches', () => {
      expect(extractCompany('write me a poem')).toBeNull();
    });
  });

  describe('extractRole', () => {
    it('detects CTO role keyword', () => {
      expect(extractRole('Who is the CTO?')).toBe('cto');
    });

    it('detects engineer role keyword', () => {
      expect(extractRole('Find all engineer contacts')).toBe('engineer');
    });

    it('returns null for unrelated query', () => {
      expect(extractRole('write a haiku')).toBeNull();
    });
  });

  describe('isContactRelated', () => {
    it('returns true for contact-related messages', () => {
      expect(isContactRelated('Who works at Acme Corp?')).toBe(true);
      expect(isContactRelated('Tell me about our contacts')).toBe(true);
      expect(isContactRelated("What's John's email?")).toBe(true);
      expect(isContactRelated('Show me all engineers')).toBe(true);
    });

    it('returns false for unrelated messages', () => {
      expect(isContactRelated('write me a haiku')).toBe(false);
      expect(isContactRelated('explain async/await')).toBe(false);
      expect(isContactRelated('what is the meaning of life?')).toBe(false);
    });
  });
});
