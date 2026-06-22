// ── FloatingField ────────────────────────────────────────────────────────────
// A glassy input with a label that floats up when you type. If type is
// "password", it also gets a show/hide eye toggle.

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function FloatingField({
  label,
  type = "text",
  value,
  onChange,
  icon, // a Lucide icon element, e.g. <Mail size={18} />
  autoComplete,
  name,
}) {
  const isPassword = type === "password";
  const [show, setShow] = useState(false);
  const inputType = isPassword ? (show ? "text" : "password") : type;

  return (
    <div className="field">
      <input
        className="field__input"
        type={inputType}
        name={name}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder=" " /* a single space lets the CSS detect "empty" state */
        required
      />
      <label className="field__label">{label}</label>

      {icon && <span className="field__icon">{icon}</span>}

      {isPassword && (
        <button
          type="button"
          className="field__toggle"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
  );
}
