import { memo, useState, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { useImportContacts } from '~/hooks/Contacts';

interface ContactImportProps {
  onImported: () => void;
}

const SAMPLE_CSV =
  'name,company,role,email,notes,industry,location\nJohn Doe,Acme Corp,CTO,john@acme.com,Met at conference,AI Infrastructure,San Francisco\nJane Smith,Stripe,VP Engineering,jane@stripe.com,Interested in partnerships,Fintech,Seattle\nBob Johnson,Google,Senior Engineer,bob@google.com,Ex-colleague,Cloud Computing,Mountain View';

function ContactImport({ onImported }: ContactImportProps) {
  const { importCSV, result, loading, error } = useImportContacts();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((f: File | null) => {
    if (f && (f.name.endsWith('.csv') || f.type === 'text/csv')) {
      setFile(f);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      handleFileChange(droppedFile || null);
    },
    [handleFileChange],
  );

  const handleImport = useCallback(async () => {
    if (!file) {
      return;
    }
    try {
      await importCSV(file);
      onImported();
    } catch {
      /* error state handled by hook */
    }
  }, [file, importCSV, onImported]);

  const downloadSample = useCallback(() => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary">Import Contacts</h3>
        <p className="mt-1 text-xs text-text-secondary">
          Upload a CSV file with contact data. First row should be headers.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 transition-colors ${
          dragOver
            ? 'border-border-heavy bg-surface-hover'
            : 'border-border-light hover:border-border-medium hover:bg-surface-hover'
        }`}
      >
        <Upload className="mb-2 h-8 w-8 text-text-tertiary" />
        <p className="text-sm text-text-secondary">
          {file ? '' : 'Drop CSV file here or click to browse'}
        </p>
        {file && (
          <div className="mt-2 flex items-center gap-2 text-sm text-text-primary">
            <FileText className="h-4 w-4" />
            <span className="truncate">{file.name}</span>
            <span className="text-xs text-text-tertiary">
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        />
      </div>

      {file && !result && (
        <button
          onClick={handleImport}
          disabled={loading}
          className="w-full rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Importing...' : 'Import'}
        </button>
      )}

      {result && (
        <div className="rounded-lg border border-border-light p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-text-primary">Import complete</span>
          </div>
          <div className="mt-2 space-y-1 text-xs text-text-secondary">
            <div>✓ {result.imported.toLocaleString()} imported</div>
            {result.failed > 0 && (
              <div className="text-red-500">✗ {result.failed.toLocaleString()} failed</div>
            )}
          </div>
          {result.errors && result.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.errors.slice(0, 5).map((err, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-red-500">
                  <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span>
                    Row {err.row}: {err.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && !result && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</div>
      )}

      <div className="rounded-lg bg-surface-hover p-3">
        <div className="mb-2 text-xs font-medium text-text-secondary">CSV Format</div>
        <p className="text-xs text-text-tertiary">
          Columns: name, company, role, email, notes + any custom columns (stored as attributes).
        </p>
        <button
          onClick={downloadSample}
          className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
        >
          <Download className="h-3 w-3" />
          Download sample CSV
        </button>
      </div>
    </div>
  );
}

export default memo(ContactImport);
