export function Marks({ ids }: { ids: readonly string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ids.map((id) => (
        <span
          key={id}
          className="border border-navy px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.08em] text-navy"
        >
          {id}
        </span>
      ))}
    </span>
  );
}
