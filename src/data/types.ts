export type Language = 'es' | 'ca';

export interface Etapa {
  id: string;
  title: Record<Language, string>;
  content: Record<Language, string>;
  image?: string;
}

export interface Section {
  id: string;
  title: Record<Language, string>;
  photo: string;
  etapas: Etapa[];
}
