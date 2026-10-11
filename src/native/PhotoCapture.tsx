import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { useSwipeBackBlock } from './useShellPresentation';
import { normalizePhotoFile } from '../lib/imageUpload';

type Props = {
  slot: string;
  upload: (file: File, progress: (percent: number) => void) => Promise<void>;
};
const accept = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
const instructions: Record<string, string> = {
  Front: 'Fit the whole front in the frame. Keep signs and setup clearly visible.',
  Back: 'Show the whole back of the setup, with the surrounding area visible.',
  'Side 1': 'Show one full side of the setup. Keep the edges in the frame.',
  'Side 2': 'Show the opposite side from Side 1. Keep the edges in the frame.',
};

// Drafts live only in this mounted contract view, never in durable browser storage.
export function PhotoCapture({ slot, upload }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const helpId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [state, setState] = useState<'ready' | 'uploading' | 'failed' | 'uploaded'>('ready');
  const [progress, setProgress] = useState(0);
  const uploading = state === 'uploading';
  useSwipeBackBlock(!!file || uploading);

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function select(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!selected || running.current) return;
    try {
      const normalized = normalizePhotoFile(selected);
      setFile(normalized);
      setError('');
      setState('ready');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to read this photo.');
    }
  }

  async function save() {
    if (!file || running.current) return;
    running.current = true;
    setState('uploading');
    setProgress(0);
    setError('');
    try {
      await upload(file, setProgress);
      setState('uploaded');
      setFile(null);
    } catch (reason) {
      setState('failed');
      setError(reason instanceof Error ? reason.message : 'Unable to upload this photo.');
    } finally {
      running.current = false;
    }
  }

  return <div className="native-photo-capture" role="group" aria-label={`${slot} photo`}>
    <p id={helpId} className="muted">{instructions[slot] || `Take a clear view of ${slot}.`}</p>
    {file && preview && <img className="native-photo-preview" src={preview} alt={`${slot} photo preview`} />}
    <div className="native-photo-actions">
      <label className="photo-upload-action">
        <span>Take photo</span>
        <input ref={camera} type="file" accept={accept} capture="environment" aria-describedby={helpId} disabled={uploading} onChange={select} />
      </label>
      <label className="photo-upload-action">
        <span>Choose from library</span>
        <input type="file" accept={accept} aria-describedby={helpId} disabled={uploading} onChange={select} />
      </label>
    </div>
    {file && <>
      <div className="native-photo-actions">
        <button className="button" disabled={uploading} onClick={() => camera.current?.click()}>Retake</button>
        <button className="button primary" disabled={uploading} onClick={() => void save()}>
          {uploading ? `Uploading… ${progress}%` : state === 'failed' ? 'Retry upload' : 'Use photo'}
        </button>
        <button className="button" disabled={uploading} onClick={() => { setFile(null); setState('ready'); setError(''); }}>Discard photo</button>
      </div>
      <small className="muted">Your photo stays available here for retry while this contract stays open. Leaving it, rechecking your account, or closing the app clears unsent photos.</small>
    </>}
    {uploading && <progress max="100" value={progress} aria-label={`${slot} upload progress`} />}
    {error && <p role="alert">{error}{state === 'failed' ? ' Your photo is still here. Retry when connected.' : ''}</p>}
    <p role="status" aria-live="polite">{state === 'uploaded' ? `${slot} — Uploaded` : uploading ? 'Uploading photo…' : ''}</p>
  </div>;
}
