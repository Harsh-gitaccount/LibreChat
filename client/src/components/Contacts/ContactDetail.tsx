import { memo, useState, useCallback } from 'react';
import { ArrowLeft, Mail, Building2, Briefcase, Trash2, Pencil, MessageSquare } from 'lucide-react';
import type { Contact } from '~/hooks/Contacts';
import { useDeleteContact } from '~/hooks/Contacts';

interface ContactDetailProps {
  contact: Contact;
  onBack: () => void;
  onEdit: (contact: Contact) => void;
  onAskAssistant: (contact: Contact) => void;
  onDeleted: () => void;
}

function ContactDetail({ contact, onBack, onEdit, onAskAssistant, onDeleted }: ContactDetailProps) {
  const { remove, loading: deleting } = useDeleteContact();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove(contact._id);
      onDeleted();
    } catch {
      setConfirmDelete(false);
    }
  }, [confirmDelete, contact._id, remove, onDeleted]);

  const attributes = contact.attributes
    ? Object.entries(
        typeof contact.attributes === 'object' && !(contact.attributes instanceof Map)
          ? contact.attributes
          : {},
      )
    : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border-light px-3 py-2.5">
        <button
          onClick={onBack}
          className="rounded-md p-1 transition-colors hover:bg-surface-hover"
          aria-label="Back to contacts"
        >
          <ArrowLeft className="h-4 w-4 text-text-secondary" />
        </button>
        <span className="flex-1 truncate text-sm font-medium text-text-primary">
          {contact.name}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">{contact.name}</h3>
            {contact.role && contact.company && (
              <p className="mt-0.5 text-sm text-text-secondary">
                {contact.role} at {contact.company}
              </p>
            )}
          </div>

          <div className="space-y-2.5">
            {contact.company && (
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-tertiary" />
                <div>
                  <div className="text-xs text-text-tertiary">Company</div>
                  <div className="text-sm text-text-primary">{contact.company}</div>
                </div>
              </div>
            )}

            {contact.role && (
              <div className="flex items-start gap-2.5">
                <Briefcase className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-tertiary" />
                <div>
                  <div className="text-xs text-text-tertiary">Role</div>
                  <div className="text-sm text-text-primary">{contact.role}</div>
                </div>
              </div>
            )}

            {contact.email && (
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-tertiary" />
                <div>
                  <div className="text-xs text-text-tertiary">Email</div>
                  <div className="text-sm text-text-primary">{contact.email}</div>
                </div>
              </div>
            )}
          </div>

          {contact.notes && (
            <div>
              <div className="mb-1 text-xs font-medium text-text-tertiary">Notes</div>
              <p className="rounded-lg bg-surface-hover p-3 text-sm text-text-primary">
                {contact.notes}
              </p>
            </div>
          )}

          {contact.tags && contact.tags.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-text-tertiary">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-surface-hover px-2.5 py-0.5 text-xs text-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {attributes.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-text-tertiary">
                Additional Details
              </div>
              <div className="rounded-lg border border-border-light">
                {attributes.map(([key, value], i) => (
                  <div
                    key={key}
                    className={`flex items-start justify-between px-3 py-2 text-sm ${
                      i > 0 ? 'border-t border-border-light' : ''
                    }`}
                  >
                    <span className="mr-2 text-text-secondary">
                      {key
                        .split('_')
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ')}
                    </span>
                    <span className="text-right text-text-primary">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border-light p-3">
        <div className="flex gap-2">
          <button
            onClick={() => onAskAssistant(contact)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-hover px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-surface-tertiary"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Ask assistant
          </button>
          <button
            onClick={() => onEdit(contact)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-surface-hover px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-surface-tertiary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              confirmDelete
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-surface-hover text-text-primary hover:bg-surface-tertiary'
            } disabled:opacity-50`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmDelete ? 'Confirm' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ContactDetail);
