export function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
        background: 'oklch(0.9 0.01 265)',
        color: 'oklch(0.15 0.02 265)',
        fontSize: 13,
        fontWeight: 600,
        padding: '10px 18px',
        borderRadius: 100,
        boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
        animation: 'fadeIn 0.15s',
        zIndex: 50,
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </div>
  );
}
