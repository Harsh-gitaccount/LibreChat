import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, Building2 } from 'lucide-react';
import type { Contact } from '~/hooks/Contacts';
import { useContacts } from '~/hooks/Contacts';

function ContactListSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg bg-surface-hover p-3">
          <div className="mb-2 h-4 w-3/4 rounded bg-surface-tertiary" />
          <div className="h-3 w-1/2 rounded bg-surface-tertiary" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onImportClick }: { onImportClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover">
        <Building2 className="h-6 w-6 text-text-tertiary" />
      </div>
      <p className="mb-1 text-sm font-medium text-text-primary">No contacts yet</p>
      <p className="mb-4 text-xs text-text-secondary">
        Import a CSV or create your first contact to get started.
      </p>
      <button
        onClick={onImportClick}
        className="rounded-lg bg-surface-hover px-4 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-surface-tertiary"
      >
        Import CSV
      </button>
    </div>
  );
}

interface ContactListProps {
  onSelect: (contact: Contact) => void;
  onImportClick: () => void;
}

function ContactList({ onSelect, onImportClick }: ContactListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Don't do anything if the search term hasn't actually changed
    if (searchTerm === debouncedSearch) {
      return;
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
      setAllContacts([]);
    }, 300);
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, debouncedSearch]);

  const { data, loading } = useContacts({
    page,
    search: debouncedSearch || undefined,
    limit: 50,
  });

  useEffect(() => {
    if (data?.contacts) {
      setAllContacts((prev) => (page === 1 ? data.contacts : [...prev, ...data.contacts]));
    }
  }, [data, page]);

  const handleLoadMore = useCallback(() => {
    if (data && page < data.totalPages) {
      setPage((p) => p + 1);
    }
  }, [data, page]);

  const hasMore = data ? page < data.totalPages : false;

  return (
    <div className="flex h-full flex-col">
      <div className="relative px-2 pb-2">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-border-light bg-surface-primary py-2 pl-9 pr-8 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {data && !loading && (
        <div className="px-3 pb-2 text-xs text-text-secondary">
          {data.total.toLocaleString()} contact{data.total !== 1 ? 's' : ''}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {loading && page === 1 ? (
          <ContactListSkeleton />
        ) : !loading && allContacts.length === 0 && !debouncedSearch ? (
          <EmptyState onImportClick={onImportClick} />
        ) : allContacts.length === 0 && debouncedSearch ? (
          <div className="py-8 text-center text-sm text-text-secondary">
            No contacts matching &ldquo;{debouncedSearch}&rdquo;
          </div>
        ) : (
          <div className="space-y-1">
            {allContacts.map((contact) => (
              <button
                key={contact._id}
                onClick={() => onSelect(contact)}
                className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
              >
                <div className="truncate text-sm font-medium text-text-primary">{contact.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
                  {contact.company && <span className="truncate">{contact.company}</span>}
                  {contact.company && contact.role && (
                    <span className="text-text-tertiary">·</span>
                  )}
                  {contact.role && <span className="truncate">{contact.role}</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="py-3 text-center">
            <button
              onClick={handleLoadMore}
              className="rounded-lg bg-surface-hover px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-tertiary"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ContactList);
