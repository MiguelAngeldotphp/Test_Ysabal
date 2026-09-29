"use client";

import { useEffect, type ReactNode } from "react";

type ModalProps = {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "default" | "wide";
};

export function Modal({ title, description, children, onClose, size = "default" }: ModalProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className={`modal modal-${size}`}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
