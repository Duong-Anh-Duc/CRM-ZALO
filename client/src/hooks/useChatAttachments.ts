import { useState, useCallback } from 'react';
import type { ChatAttachment } from '../types/chat';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_FILES = 4;
const MAX_SIZE = 10 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

export function useChatAttachments() {
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError(null);

    const slots = MAX_FILES - pending.length;
    if (slots <= 0) {
      setError(`Tối đa ${MAX_FILES} file`);
      return;
    }
    const batch = list.slice(0, slots);

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const uploaded: ChatAttachment[] = [];
      for (const file of batch) {
        if (file.size > MAX_SIZE) {
          setError(`${file.name} quá 10MB`);
          continue;
        }
        const dataUrl = await readAsDataUrl(file);
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ file: dataUrl, folder: 'chatbot' }),
        });
        if (!res.ok) {
          setError('Upload lỗi');
          continue;
        }
        const json = await res.json();
        const url: string | undefined = json?.data?.url;
        if (url) {
          uploaded.push({
            url: url.startsWith('http') ? url : `${window.location.origin}${url}`,
            type: file.type.startsWith('image/') ? 'image' : 'file',
            name: file.name,
            mimeType: file.type,
          });
        }
      }
      if (uploaded.length > 0) setPending((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }, [pending.length]);

  const removeAt = useCallback((index: number) => {
    setPending((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => {
    setPending([]);
    setError(null);
  }, []);

  return { pending, uploading, error, addFiles, removeAt, clear, accept: ACCEPT };
}
