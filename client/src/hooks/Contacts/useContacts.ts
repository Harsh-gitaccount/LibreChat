import { useState, useCallback, useEffect, useRef } from 'react';
import { request } from 'librechat-data-provider';

export interface Contact {
  _id: string;
  name: string;
  company: string;
  role: string;
  email: string;
  notes: string;
  tags: string[];
  attributes: Record<string, string>;
  user: string;
  created_at: string;
  updated_at: string;
}

interface ContactsResponse {
  contacts: Contact[];
  total: number;
  page: number;
  totalPages: number;
}

interface SearchResponse {
  contacts: Contact[];
  query: string;
  keywords: string[];
}

interface ImportResult {
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

interface ContactsParams {
  page?: number;
  search?: string;
  company?: string;
  role?: string;
  tag?: string;
  limit?: number;
}

export function useContacts(params: ContactsParams = {}) {
  const { page = 1, search, company, role, tag, limit = 50 } = params;
  const [data, setData] = useState<ContactsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', String(limit));
      if (search) {
        query.set('search', search);
      }
      if (company) {
        query.set('company', company);
      }
      if (role) {
        query.set('role', role);
      }
      if (tag) {
        query.set('tag', tag);
      }
      const result = await request.get<ContactsResponse>(`/api/contacts?${query.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, company, role, tag]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  return { data, loading, error, refetch: fetchContacts };
}

export function useContact(id: string | null) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setContact(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    request.get<Contact>(`/api/contacts/${encodeURIComponent(id)}`)
      .then((c) => {
        if (!cancelled) {
          setContact(c);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch contact');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { contact, loading, error };
}

export function useCreateContact() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (contactData: Partial<Contact>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await request.post('/api/contacts', contactData);
      return result as Contact;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create contact';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error };
}

export function useUpdateContact() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (id: string, contactData: Partial<Contact>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await request.put(`/api/contacts/${encodeURIComponent(id)}`, contactData);
      return result as Contact;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update contact';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { update, loading, error };
}

export function useDeleteContact() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await request.delete<{ success: boolean }>(`/api/contacts/${encodeURIComponent(id)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete contact';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { remove, loading, error };
}

export function useImportContacts() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importCSV = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await request.postMultiPart('/api/contacts/import', formData);
      setResult(data as ImportResult);
      return data as ImportResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { importCSV, result, loading, error };
}

export function useContactCompanies() {
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) {
      return;
    }
    fetchedRef.current = true;
    setLoading(true);
    request.get<{ companies: string[] }>('/api/contacts/companies')
      .then((data) => setCompanies(data.companies))
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }, []);

  return { companies, loading };
}

export function useSearchContacts() {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await request.get<SearchResponse>(
        `/api/contacts/search/query?q=${encodeURIComponent(query)}`
      );
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, search, loading, error };
}
