import { useRef } from "react";

export default function OtpInput({ value, onChange }) {
  const inputs = useRef([]);

  // `value` is always a 6-char string, e.g. "04" → ["0","4","","","",""]
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  function handleChange(e, index) {
    const char = e.target.value.replace(/\D/g, "").slice(-1); // digits only
    const next = [...digits];
    next[index] = char;
    onChange(next.join(""));
    if (char && index < 5) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(e, index) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6));
    // Focus the box after the last pasted digit.
    const nextFocus = Math.min(pasted.length, 5);
    inputs.current[nextFocus]?.focus();
  }

  return (
    <div className="otp-row">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          className={`otp-box${digit ? " otp-box--filled" : ""}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={handlePaste}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}
