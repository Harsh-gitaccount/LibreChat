import { memo, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { Contact } from '~/hooks/Contacts';
import ContactList from './ContactList';
import ContactDetail from './ContactDetail';
import ContactForm from './ContactForm';
import ContactImport from './ContactImport';

type View =
  | { type: 'list' }
  | { type: 'detail'; contact: Contact }
  | { type: 'form'; contact?: Contact }
  | { type: 'import' };

function ContactsPanel() {
  const [view, setView] = useState<View>({ type: 'list' });
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSelect = useCallback((contact: Contact) => {
    setView({ type: 'detail', contact });
  }, []);

  const handleBack = useCallback(() => {
    setView({ type: 'list' });
  }, []);

  const handleEdit = useCallback((contact: Contact) => {
    setView({ type: 'form', contact });
  }, []);

  const handleCreate = useCallback(() => {
    setView({ type: 'form' });
  }, []);

  const handleImportClick = useCallback(() => {
    setView({ type: 'import' });
  }, []);

  const handleSaved = useCallback(() => {
    refresh();
    setView({ type: 'list' });
  }, [refresh]);

  const handleDeleted = useCallback(() => {
    refresh();
    setView({ type: 'list' });
  }, [refresh]);

  const handleAskAssistant = useCallback((contact: Contact) => {
    const message = `What do we know about ${contact.name}${contact.company ? ` from ${contact.company}` : ''}?`;
    const textarea = document.getElementById('prompt-textarea') as HTMLTextAreaElement | null;
    if (textarea) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      nativeInputValueSetter?.call(textarea, message);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
    }
  }, []);

  const handleImported = useCallback(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="flex h-full flex-col pt-2">
      {view.type === 'list' && (
        <>
          <div className="flex items-center justify-between px-3 pb-2">
            <h2 className="text-sm font-semibold text-text-primary">Contacts</h2>
            <div className="flex gap-1">
              <button
                onClick={handleImportClick}
                className="rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                Import
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                <Plus className="h-3 w-3" />
                New
              </button>
            </div>
          </div>
          <div key={refreshKey} className="min-h-0 flex-1">
            <ContactList onSelect={handleSelect} onImportClick={handleImportClick} />
          </div>
        </>
      )}

      {view.type === 'detail' && (
        <ContactDetail
          contact={view.contact}
          onBack={handleBack}
          onEdit={handleEdit}
          onAskAssistant={handleAskAssistant}
          onDeleted={handleDeleted}
        />
      )}

      {view.type === 'form' && (
        <ContactForm
          contact={view.type === 'form' ? view.contact : undefined}
          onBack={handleBack}
          onSaved={handleSaved}
        />
      )}

      {view.type === 'import' && (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-border-light px-3 py-2.5">
            <button
              onClick={handleBack}
              className="rounded-md p-1 transition-colors hover:bg-surface-hover"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-text-secondary"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            </button>
            <span className="text-sm font-medium text-text-primary">Import Contacts</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ContactImport onImported={handleImported} />
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ContactsPanel);
