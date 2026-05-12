import { memo, useState, useCallback } from 'react';
import { ArrowLeft, X, Plus } from 'lucide-react';
import type { Contact } from '~/hooks/Contacts';
import { useCreateContact, useUpdateContact } from '~/hooks/Contacts';

interface ContactFormProps {
  contact?: Contact | null;
  onBack: () => void;
  onSaved: () => void;
}

function ContactForm({ contact, onBack, onSaved }: ContactFormProps) {
  const isEditing = !!contact;
  const { create, loading: creating } = useCreateContact();
  const { update, loading: updating } = useUpdateContact();
  const loading = creating || updating;

  const [name, setName] = useState(contact?.name || '');
  const [company, setCompany] = useState(contact?.company || '');
  const [role, setRole] = useState(contact?.role || '');
  const [email, setEmail] = useState(contact?.email || '');
  const [notes, setNotes] = useState(contact?.notes || '');
  const [tags, setTags] = useState<string[]>(contact?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [attributes, setAttributes] = useState<Array<{ key: string; value: string }>>(
    contact?.attributes
      ? Object.entries(
          typeof contact.attributes === 'object' && !(contact.attributes instanceof Map)
            ? contact.attributes
            : {},
        ).map(([key, value]) => ({ key, value }))
      : [],
  );
  const [error, setError] = useState<string | null>(null);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && tagInput.trim()) {
        e.preventDefault();
        const newTag = tagInput.trim();
        if (!tags.includes(newTag)) {
          setTags((prev) => [...prev, newTag]);
        }
        setTagInput('');
      }
    },
    [tagInput, tags],
  );

  const removeTag = useCallback((tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  }, []);

  const addAttribute = useCallback(() => {
    setAttributes((prev) => [...prev, { key: '', value: '' }]);
  }, []);

  const updateAttribute = useCallback((index: number, field: 'key' | 'value', val: string) => {
    setAttributes((prev) => prev.map((attr, i) => (i === index ? { ...attr, [field]: val } : attr)));
  }, []);

  const removeAttribute = useCallback((index: number) => {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!name.trim()) {
        setError('Name is required');
        return;
      }

      const attrObj: Record<string, string> = {};
      for (const attr of attributes) {
        if (attr.key.trim() && attr.value.trim()) {
          attrObj[attr.key.trim()] = attr.value.trim();
        }
      }

      const data = {
        name: name.trim(),
        company: company.trim(),
        role: role.trim(),
        email: email.trim(),
        notes: notes.trim(),
        tags,
        attributes: attrObj,
      };

      try {
        if (isEditing && contact) {
          await update(contact._id, data);
        } else {
          await create(data);
        }
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save contact');
      }
    },
    [name, company, role, email, notes, tags, attributes, isEditing, contact, create, update, onSaved],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border-light px-3 py-2.5">
        <button
          onClick={onBack}
          className="rounded-md p-1 transition-colors hover:bg-surface-hover"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4 text-text-secondary" />
        </button>
        <span className="text-sm font-medium text-text-primary">
          {isEditing ? 'Edit Contact' : 'New Contact'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3 p-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Company</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
              placeholder="Acme Corp"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
              placeholder="CTO"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
              placeholder="john@acme.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
              placeholder="Notes about this contact..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Tags</label>
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-border-light bg-surface-primary px-2 py-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-surface-hover px-2 py-0.5 text-xs text-text-secondary"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-text-tertiary hover:text-text-primary"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="min-w-[80px] flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
                placeholder={tags.length > 0 ? '' : 'Type and press Enter'}
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">Custom Fields</label>
              <button
                type="button"
                onClick={addAttribute}
                className="flex items-center gap-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
              >
                <Plus className="h-3 w-3" />
                Add field
              </button>
            </div>
            {attributes.length > 0 && (
              <div className="space-y-2">
                {attributes.map((attr, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={attr.key}
                      onChange={(e) => updateAttribute(i, 'key', e.target.value)}
                      className="w-2/5 rounded-lg border border-border-light bg-surface-primary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
                      placeholder="Key"
                    />
                    <input
                      type="text"
                      value={attr.value}
                      onChange={(e) => updateAttribute(i, 'value', e.target.value)}
                      className="flex-1 rounded-lg border border-border-light bg-surface-primary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
                      placeholder="Value"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttribute(i)}
                      className="flex-shrink-0 text-text-tertiary hover:text-text-primary"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border-light p-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Contact'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default memo(ContactForm);
