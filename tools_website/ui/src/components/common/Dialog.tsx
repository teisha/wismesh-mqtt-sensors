import type { ReactNode } from "react";

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
};

function Dialog({ open, title, description, children, footer, onClose }: DialogProps) {
  if (!open) {
    return null;
  }

  const dialogTitleId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-title`;

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby={dialogTitleId} onClick={(event) => event.stopPropagation()}>
        <header className="dialog-header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h3 id={dialogTitleId}>{title}</h3>
            {description ? <p className="subcopy dialog-copy">{description}</p> : null}
          </div>
          <button type="button" className="secondary ghost" onClick={onClose} aria-label="Close dialog">
            Close
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        <footer className="dialog-footer">{footer}</footer>
      </section>
    </div>
  );
}

export default Dialog;