"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { searchProfiles } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";

const SEARCH_DELAY_MS = 250;

// Kolom @username dengan saran: kontak (dari riwayat surat) lalu pengguna lain dari server.
export default function RecipientInput({ value, onChange, contacts, readOnly, describedBy, invalid }) {
  const { t } = useI18n();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remote, setRemote] = useState([]);
  const query = value.trim().toLowerCase().replace(/^@/, "");

  const contactMatches = useMemo(() => {
    const list = contacts.filter(
      (c) => !query || c.username.startsWith(query) || c.displayName.toLowerCase().includes(query),
    );
    return list.slice(0, 5);
  }, [contacts, query]);

  useEffect(() => {
    if (readOnly || !open || !query) return setRemote([]);
    let cancelled = false;
    const id = setTimeout(async () => {
      const res = await searchProfiles(query);
      if (!cancelled) setRemote(res.results ?? []);
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, open, readOnly]);

  const known = new Set(contactMatches.map((c) => c.username));
  const others = remote.filter((r) => !known.has(r.username));
  const options = [...contactMatches.map((c) => ({ ...c, group: "contacts" })), ...others.map((r) => ({ ...r, group: "people" }))];
  // Sembunyikan jika satu-satunya saran sama persis dengan yang sudah diketik.
  const exact = options.length === 1 && options[0].username === query;
  const showList = open && !readOnly && !exact && (options.length > 0 || query.length >= 2);

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

  let lastGroup = null;

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
        <ul id={listId} role="listbox" className="combo__list">
          {options.length === 0 && <li className="combo__empty">{t("mail.noMatches")}</li>}
          {options.map((o, i) => {
            const header = o.group !== lastGroup ? (lastGroup = o.group) : null;
            return (
              <li key={o.username} role="presentation">
                {header && <span className="combo__group">{t(header === "contacts" ? "mail.contacts" : "mail.people")}</span>}
                <div
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
                  {o.label && <small>📍 {o.label}</small>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
