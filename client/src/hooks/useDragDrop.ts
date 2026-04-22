import { useState, useCallback, useRef } from 'react';

/**
 * Drag-and-drop state + handlers for a drop zone. Tracks a depth counter so
 * nested elements don't flicker the overlay on every boundary crossing.
 */
export function useDragDrop(onFiles: (files: FileList) => void) {
  const [isDragging, setIsDragging] = useState(false);
  const depth = useRef(0);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    depth.current += 1;
    setIsDragging(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) onFiles(files);
  }, [onFiles]);

  return { isDragging, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
