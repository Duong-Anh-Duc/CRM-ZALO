import apiClient from '@/lib/api-client';

/**
 * Upload a file (as base64 data URL) to server and get back a permanent URL.
 * Falls back to returning the base64 if upload fails.
 */
export async function uploadFile(file: File, folder = 'general'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await apiClient.post('/upload', { file: base64, folder });
        resolve(res.data?.data?.url || base64);
      } catch {
        // Fallback: return base64 if upload service unavailable
        resolve(base64);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
