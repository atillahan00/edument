export const designs = [
  { value: 'ultra', label: 'Ultra minimal' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'brutalist', label: 'Neobrutalism' },
  { value: 'glass', label: 'Glassmorphism' },
] as const;
export type Design = (typeof designs)[number]['value'];
export const designKey = 'edument-design';
export function validDesign(value: unknown): value is Design {
  return designs.some((design) => design.value === value);
}
// Only allow known style names. This runs before paint, without touching application data.
export const designInit = `try{var d=localStorage.getItem('${designKey}');if(${JSON.stringify(designs.map((d) => d.value))}.includes(d))document.documentElement.dataset.design=d;}catch{}`;
