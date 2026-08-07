export function Fab({ onClick, bottom = 86 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add"
      style={{
        position: 'absolute',
        right: 20,
        bottom: `calc(env(safe-area-inset-bottom, 0px) + ${bottom}px)`,
        width: 56,
        height: 56,
        borderRadius: 18,
        border: 'none',
        background: 'oklch(0.72 0.14 245)',
        color: 'oklch(0.14 0.02 265)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 20px oklch(0.72 0.14 245 / 0.35)',
        cursor: 'pointer',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
        add
      </span>
    </button>
  );
}
