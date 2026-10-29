/**
 * Lista desplegable con el estilo de la app: el selector nativo (cómodo en el teléfono y sin
 * desbordes con muchas opciones) con borde redondeado, texto en negrita y flecha propia.
 */
export function SelectField(props: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-600">{props.label}</span>
      <span className="relative mt-1.5 block">
        <select
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full appearance-none rounded-2xl bg-slate-50 py-3 pr-11 pl-4 text-base font-bold text-ink ring-1 ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-brand-400 focus:outline-none"
        >
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-brand-600" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
      {props.hint && <span className="mt-1 block text-xs text-slate-500">{props.hint}</span>}
    </label>
  );
}
