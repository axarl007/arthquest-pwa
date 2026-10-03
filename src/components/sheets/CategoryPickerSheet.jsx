import { useState } from 'react';
import { useTheme } from '../../theme/useTheme.js';
import { BottomSheet } from './BottomSheet.jsx';
import { CategoryIcon } from '../CategoryIcon.jsx';

/** Searchable category list in a sheet — `options` from categoryOptionsForType(). */
export function CategoryPickerSheet({ title, options, selectedId, onSelect, onClose }) {
  const { T, C, iconStyle } = useTheme();
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const filtered = query ? options.filter((o) => o.name.toLowerCase().includes(query)) : options;

  return (
    <BottomSheet onClose={onClose} maxHeight="75%">
      <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: T.text }}>{title}</div>
      <input
        type="text"
        placeholder="Search categories"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', background: T.inputBg, border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, color: T.text, outline: 'none', marginTop: 12 }}
      />
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filtered.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, border: 'none', borderRadius: 10, padding: '9px 8px', cursor: 'pointer', textAlign: 'left',
              background: o.id === selectedId ? T.btnSecondaryBg : 'none',
            }}
          >
            <CategoryIcon icon={o.icon} color={o.color} iconStyle={iconStyle} size={26} glyphBase={14} />
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: T.text }}>{o.name}</span>
            <span style={{ fontSize: 11, color: T.textTertiary }}>{o.tag}</span>
            {o.id === selectedId && <span className="material-symbols-outlined" style={{ fontSize: 16, color: C.accent }}>check</span>}
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 14, fontSize: 13, color: T.textTertiary }}>
            {options.length === 0 ? 'No categories of this type yet' : 'No matches'}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
