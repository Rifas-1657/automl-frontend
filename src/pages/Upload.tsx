import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toast } from 'react-hot-toast';

const Upload: React.FC = () => {
  const { api, token } = useAuth() as any;
  const navigate = useNavigate();

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = '.csv,.xlsx,.xls,.json';
  const MAX_BYTES = 100 * 1024 * 1024; // 100MB
  const ALLOWED_EXT = ['.csv', '.xlsx', '.xls', '.json'];

  const glass = useMemo(() => ({
    background: 'rgba(15,23,42,0.4)',
    border: '1px solid rgba(148,163,184,0.15)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: 16
  } as React.CSSProperties), []);

  const simpleCsvPreview = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 6); // header + 5 rows
      if (lines.length === 0) return;
      const splitLine = (l: string) => l.split(',');
      const headers = splitLine(lines[0]);
      const rows = lines.slice(1).map((l) => {
        const vals = splitLine(l);
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
        return obj;
      });
      setPreviewHeaders(headers);
      setPreviewRows(rows);
    } catch {}
  };

  const jsonPreview = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const arr = Array.isArray(json) ? json : (json?.data && Array.isArray(json.data) ? json.data : []);
      const slice = arr.slice(0, 5);
      const headers = slice[0] ? Object.keys(slice[0]) : [];
      setPreviewHeaders(headers);
      setPreviewRows(slice);
    } catch {}
  };

  const parsePreview = async (file: File) => {
    setPreviewRows(null);
    setPreviewHeaders(null);
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.csv')) return simpleCsvPreview(file);
    if (lower.endsWith('.json')) return jsonPreview(file);
    // Excel preview not supported without additional libs; silently skip
  };

  // Internal helpers that return headers/rows without touching state
  const parseCsvHeadersRows = async (file: File): Promise<{ headers: string[]; rows: any[] }> => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 6);
    if (lines.length === 0) return { headers: [], rows: [] };
    const splitLine = (l: string) => l.split(',');
    const headers = splitLine(lines[0]);
    const rows = lines.slice(1).map((l) => {
      const vals = splitLine(l);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj;
    });
    return { headers, rows };
  };

  const parseJsonHeadersRows = async (file: File): Promise<{ headers: string[]; rows: any[] }> => {
    const text = await file.text();
    const json = JSON.parse(text);
    const arr = Array.isArray(json) ? json : (json?.data && Array.isArray(json.data) ? json.data : []);
    const slice = arr.slice(0, 5);
    const headers = slice[0] ? Object.keys(slice[0]) : [];
    return { headers, rows: slice };
  };

  const detectColumns = async (file: File, retries = 3): Promise<{ headers: string[]; rows: any[] }> => {
    const lower = file.name.toLowerCase();
    for (let i = 0; i < retries; i++) {
      try {
        const result = lower.endsWith('.csv')
          ? await parseCsvHeadersRows(file)
          : lower.endsWith('.json')
            ? await parseJsonHeadersRows(file)
            : { headers: [], rows: [] };
        if (result.headers?.length > 0) return result;
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        if (i === retries - 1) throw error;
      }
    }
    throw new Error('Could not detect columns after multiple attempts');
  };

  const validateFileBasics = (file: File): string | null => {
    const lower = file.name.toLowerCase();
    const allowed = ALLOWED_EXT.some(ext => lower.endsWith(ext));
    if (!allowed) return 'Unsupported file type. Allowed: CSV, Excel, JSON';
    if (file.size > MAX_BYTES) return 'File too large. Maximum size is 100MB';
    return null;
  };

  const validateStructure = (headers: string[] | null, rows: any[] | null): string | null => {
    if (!headers || headers.length === 0) return 'Could not detect any columns in the file';
    if (!rows || rows.length === 0) return 'No sample rows found in the file';
    // If every cell in preview is empty, likely malformed
    const totalCells = rows.length * headers.length;
    let emptyCells = 0;
    for (const row of rows) {
      for (const h of headers) {
        const v = row?.[h];
        if (v === undefined || v === null || String(v).trim() === '') emptyCells++;
      }
    }
    if (totalCells > 0 && emptyCells === totalCells) {
      return 'All previewed values are empty; please check the file structure';
    }
    return null;
  };

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setErrorMsg('');
    setSuccess(false);
    setFileName(file.name);
    setLastFile(file);
    const basicError = validateFileBasics(file);
    if (basicError) {
      setErrorMsg(basicError);
      toast.error(basicError);
      return;
    }
    // Robust, synchronous detection to avoid async state timing issues
    let detected: { headers: string[]; rows: any[] };
    try {
      detected = await detectColumns(file, 3);
    } catch (e: any) {
      const msg = e?.message || 'Could not detect columns';
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    setPreviewHeaders(detected.headers);
    setPreviewRows(detected.rows);
    const structError = validateStructure(detected.headers, detected.rows);
    if (structError) {
      setErrorMsg(structError);
      toast.error(structError);
      return;
    }
    await doUploadWithRetry(file);
  };

  const doUpload = async (file: File) => {
    try {
      setUploading(true);
      setProgress(1);
      const form = new FormData();
      form.append('file', file);
      
      // Upload file
      const { data } = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        onUploadProgress: (evt: any) => {
          if (!evt.total) return;
          const pct = Math.round((evt.loaded * 100) / evt.total);
          setProgress(pct);
        }
      });
      
      const datasetId = data?.dataset?.id ?? data?.id ?? data?.dataset_id ?? 1;
      
      // Validate data integrity by fetching raw preview
      try {
        const previewResponse = await api.get(`/datasets/${datasetId}/preview`);
        const rawData = previewResponse.data;
        
        console.log('✅ RAW DATA PREVIEW:', rawData);
        console.log('✅ RAW DATA SAMPLE:', rawData.sample_data);
        console.log('✅ PREPROCESSING APPLIED:', rawData.preprocessing_applied);
        
        if (rawData.preprocessing_applied) {
          console.warn('⚠️ WARNING: Data preprocessing was applied during upload!');
          toast.error('Data corruption detected! Please re-upload the file.');
          return;
        }
        
        // Update preview with RAW data from server
        setPreviewHeaders(rawData.columns);
        setPreviewRows(rawData.sample_data);
        
        toast.success('Upload complete with RAW data preserved!');
      } catch (previewError) {
        console.warn('⚠️ Could not validate data integrity:', previewError);
        toast.success('Upload complete. Redirecting...');
      }
      
      setSuccess(true);
      setTimeout(() => navigate(`/analyze/${datasetId}`), 700);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || 'Upload failed');
      setUploading(false);
      setProgress(0);
    }
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const doUploadWithRetry = async (file: File, maxRetries = 2) => {
    let attempt = 0;
    while (attempt <= maxRetries) {
      const prev = attempt;
      try {
        await doUpload(file);
        return;
      } catch (e) {
        attempt++;
        if (attempt > maxRetries) {
          setErrorMsg('Upload failed. Please try again.');
          return;
        }
        await sleep(Math.min(2000, 500 * Math.pow(2, prev)));
      }
    }
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await onFiles(e.dataTransfer.files || null);
  };

  const onBrowse = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await onFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ margin: '0 auto', maxWidth: 980 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 800, margin: 0 }}>Upload Your Dataset</h1>
          <p style={{ color: '#94a3b8', marginTop: 8 }}>Drag & drop a file or browse to begin analysis</p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={onBrowse}
          style={{
            ...glass,
            padding: 28,
            borderStyle: 'dashed',
            borderWidth: 2,
            borderColor: isDragging ? '#8b5cf6' : 'rgba(148,163,184,0.25)',
            transition: 'border-color 150ms ease, transform 150ms ease',
            transform: isDragging ? 'scale(1.01)' : 'scale(1)',
            cursor: uploading ? 'not-allowed' : 'pointer'
          }}
        >
          <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
            <div style={{ fontSize: 48, lineHeight: '48px', marginBottom: 8 }}>📁</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>{isDragging ? 'Drop to upload' : 'Drag & Drop your dataset here'}</div>
            <div style={{ color: '#94a3b8', marginTop: 6 }}>Supports CSV, Excel, JSON up to 100MB</div>
            <button
              disabled={uploading}
              style={{
                marginTop: 14,
                padding: '10px 16px',
                borderRadius: 12,
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: uploading ? 'not-allowed' : 'pointer'
              }}
            >Browse Files</button>
          </div>
          <input ref={inputRef} type="file" accept={accept} onChange={onChange} style={{ display: 'none' }} />
        </div>

        {/* File meta + Progress */}
        {(fileName || uploading) && (
          <div style={{ ...glass, marginTop: 16, padding: 16 }}>
            {fileName && (
              <div style={{ color: '#e2e8f0', marginBottom: 10 }}>Selected: {fileName}</div>
            )}
            {uploading && (
              <div>
                <div style={{ height: 10, background: 'rgba(148,163,184,0.2)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
                </div>
                <div style={{ color: '#94a3b8', marginTop: 6 }}>{progress}%</div>
              </div>
            )}
            {!uploading && errorMsg && (
              <div style={{ marginTop: 10, color: '#fca5a5', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>⚠️</span>
                <span>{errorMsg}</span>
                {lastFile && (
                  <button
                    onClick={() => doUploadWithRetry(lastFile)}
                    style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 10, border: '1px solid #fca5a5', background: 'transparent', color: '#fca5a5', cursor: 'pointer' }}
                  >Retry Upload</button>
                )}
              </div>
            )}
            {success && (
              <div style={{ marginTop: 10, color: '#10b981', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>✅</span>
                <span>Successfully uploaded</span>
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {previewRows && previewRows.length > 0 && (
          <div style={{ ...glass, marginTop: 16, padding: 16 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 10 }}>File Preview (first 5 rows)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#cbd5e1', fontSize: 13 }}>
                <thead>
                  <tr>
                    {(previewHeaders || []).map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(148,163,184,0.25)', color: '#e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx}>
                      {(previewHeaders || []).map((h) => (
                        <td key={h} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>{String(row[h] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;