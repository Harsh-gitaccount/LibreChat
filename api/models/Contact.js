const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    company: {
      type: String,
      default: '',
      index: true,
    },
    role: {
      type: String,
      default: '',
      index: true,
    },
    email: {
      type: String,
      default: '',
      index: true,
      sparse: true,
    },
    notes: {
      type: String,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    attributes: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
    searchable_attributes: {
      type: String,
      default: '',
    },
    user: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
);

contactSchema.index(
  { name: 'text', company: 'text', role: 'text', notes: 'text', email: 'text', searchable_attributes: 'text' },
  { weights: { name: 10, company: 5, role: 5, email: 3, notes: 1, searchable_attributes: 1 } },
);

contactSchema.index({ created_at: -1 });

contactSchema.methods.toPromptString = function () {
  const parts = [];
  if (this.name) {
    parts.push(`Name: ${this.name}`);
  }
  if (this.company) {
    parts.push(`Company: ${this.company}`);
  }
  if (this.role) {
    parts.push(`Role: ${this.role}`);
  }
  if (this.email) {
    parts.push(`Email: ${this.email}`);
  }
  if (this.notes) {
    parts.push(`Notes: ${this.notes}`);
  }
  if (this.tags && this.tags.length > 0) {
    parts.push(`Tags: ${this.tags.join(', ')}`);
  }
  if (this.attributes && this.attributes.size > 0) {
    for (const [key, value] of this.attributes) {
      const formattedKey = key
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      parts.push(`${formattedKey}: ${value}`);
    }
  }
  return parts.join(' | ');
};

const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);

module.exports = Contact;
