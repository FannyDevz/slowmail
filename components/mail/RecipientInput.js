"use client";

import { useId, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

const MAX_SUGGESTIONS = 6;

// Kolom @username. Saran hanya dari kontak (orang yang pernah berkirim surat dengan kita),
// supaya daftar pengguna tidak bisa ditelusuri. Penerima baru tetap bisa diketik lengkap.
export default function RecipientInput({ value, onChange, contacts, readOnly, describedBy, invalid }) {
  const { t } = useI18n();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const query = value.trim().toLowerCase().replace(/^@/, "");

  const options = useMemo(
    () =>
      contacts
        .filter((c) => !query || c.username.startsWith(query) || c.displayName.toLowerCase().includes(query))
        .slice(0, MAX_SUGGESTIONS),
    [contacts, query],
  );
  // Sembunyikan jika tidak ada saran, atau satu-satunya saran sama persis dengan yang sudah diketik.
  const exact = options.length === 1 && options[0].username === query;
  const showList = open && !readOnly && options.length > 0 && !exact;

  function choose(option) {
    onChange(option.username);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e) {
    if (!showList) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="combo">
      <div className="input-prefix">
        <span aria-hidden="true">@</span>
        <input
          id="to"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          readOnly={readOnly}
          placeholder={t("mail.toPlaceholder")}
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          onChange={(e) => {
            onChange(e.target.value.replace(/\s/g, ""));
            setOpen(true);
            setActive(-1);
          }}
        />
      </div>
      {showList && (
        <ul id={listId} role="listbox" aria-label={t("mail.contacts")} className="combo__list">
          <li role="presentation" className="combo__group">{t("mail.contacts")}</li>
          {options.map((o, i) => (
            <li
              key={o.username}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="combo__option"
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
            >
              <strong>@{o.username}</strong> <span>{o.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
