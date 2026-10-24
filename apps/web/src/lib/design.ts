export const designs = [
  { value: 'ultra', label: 'Çok sade' },
  { value: 'minimal', label: 'Sade' },
  { value: 'brutalist', label: 'Keskin çizgiler' },
  { value: 'glass', label: 'Cam etkisi' },
] as const;
export type Design = (typeof designs)[number]['value'];
export const designKey = 'edument-design';
export function validDesign(value: unknown): value is Design {
  return designs.some((design) => design.value === value);
}
// Yalnızca tanımlı görünümler kabul edilir; tercih ilk çizimden önce uygulanır.
export const designInit = `try{var d=localStorage.getItem('${designKey}');if(${JSON.stringify(designs.map((d) => d.value))}.includes(d))document.documentElement.dataset.design=d;}catch{}`;
