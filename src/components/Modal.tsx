import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string; // e.g. 'max-w-md', 'max-w-sm', 'max-w-lg'
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md'
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[9999] bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}
    >
      <div
        className={`glass-panel-classy p-5 sm:p-6 rounded-3xl ${maxWidth} w-full max-h-[85vh] overflow-y-auto space-y-4 border border-zinc-800/90 animate-scale-up shadow-2xl relative text-xs my-auto`}
      >
        <div className="flex justify-between items-center text-sm font-bold text-zinc-100 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 font-black">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl bg-zinc-900 text-zinc-400 hover:text-zinc-100 border border-zinc-800 cursor-pointer transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
};
