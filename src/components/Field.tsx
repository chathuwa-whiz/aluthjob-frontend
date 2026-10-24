import { AlertCircle } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cx } from "../lib/cx";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
}

function describedBy(...ids: (string | false | undefined)[]) {
  return ids.filter(Boolean).join(" ") || undefined;
}

function FieldFrame({ label, hint, error, optional, htmlFor, hintId, errorId, children }: FieldProps & { htmlFor: string; hintId: string; errorId: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {optional && <span className="field__optional"> (optional)</span>}
      </label>
      {children}
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export function TextField({ label, hint, error, optional, id, className, ...input }: FieldProps & ComponentProps<"input">) {
  const uid = useId();
  const inputId = id ?? uid;
  return (
    <FieldFrame label={label} hint={hint} error={error} optional={optional} htmlFor={inputId} hintId={`${inputId}-hint`} errorId={`${inputId}-error`}>
      <input
        id={inputId}
        className={cx("input", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint ? `${inputId}-hint` : undefined, error ? `${inputId}-error` : undefined)}
        {...input}
      />
    </FieldFrame>
  );
}

export function TextAreaField({ label, hint, error, optional, id, className, ...input }: FieldProps & ComponentProps<"textarea">) {
  const uid = useId();
  const inputId = id ?? uid;
  return (
    <FieldFrame label={label} hint={hint} error={error} optional={optional} htmlFor={inputId} hintId={`${inputId}-hint`} errorId={`${inputId}-error`}>
      <textarea
        id={inputId}
        className={cx("textarea", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint ? `${inputId}-hint` : undefined, error ? `${inputId}-error` : undefined)}
        {...input}
      />
    </FieldFrame>
  );
}

/** A password box with a Show/Hide control, so typos in a long passphrase can be checked. */
export function PasswordField({ label, hint, error, optional, id, className, ...input }: FieldProps & Omit<ComponentProps<"input">, "type">) {
  const uid = useId();
  const inputId = id ?? uid;
  const [shown, setShown] = useState(false);

  return (
    <FieldFrame label={label} hint={hint} error={error} optional={optional} htmlFor={inputId} hintId={`${inputId}-hint`} errorId={`${inputId}-error`}>
      <div className="input-affix">
        <input
          id={inputId}
          className={cx("input", className)}
          type={shown ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint ? `${inputId}-hint` : undefined, error ? `${inputId}-error` : undefined)}
          autoCapitalize="none"
          spellCheck={false}
          {...input}
        />
        <button type="button" className="input-affix__button" onClick={() => setShown((value) => !value)} aria-label={shown ? "Hide password" : "Show password"}>
          {shown ? "Hide" : "Show"}
        </button>
      </div>
    </FieldFrame>
  );
}
