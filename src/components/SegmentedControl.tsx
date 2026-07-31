interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, labels }: Props<T>) {
  return (
    <div className="flex border border-white">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${
            value === option ? "bg-white text-black" : "text-white/60 hover:text-white"
          }`}
        >
          {labels?.[option] ?? option}
        </button>
      ))}
    </div>
  );
}
