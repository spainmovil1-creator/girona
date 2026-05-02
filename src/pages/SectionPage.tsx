import { useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import rehypeSlug from 'rehype-slug';
import { data } from '../data';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';

import { ArrowLeft, Home as HomeIcon, ChevronRight, ChevronLeft } from 'lucide-react';

export default function SectionPage() {
  const { id } = useParams();
  const { search } = useLocation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const sectionIndex = data.findIndex(s => s.id === id);
  const section = data[sectionIndex];
  
  const params = new URLSearchParams(search);
  const etapaIndexStr = params.get('etapa');
  const etapaIndex = etapaIndexStr ? parseInt(etapaIndexStr, 10) : 0;
  
  const etapa = section?.etapas[etapaIndex];

  // Calculate global previous and next
  const allChapters = data.flatMap(s => s.etapas.map((e, i) => ({ sectionId: s.id, etapa: e, index: i })));
  const currentGlobalIndex = allChapters.findIndex(c => c.sectionId === id && c.index === etapaIndex);
  
  const prevChapter = currentGlobalIndex > 0 ? allChapters[currentGlobalIndex - 1] : null;
  const nextChapter = currentGlobalIndex >= 0 && currentGlobalIndex < allChapters.length - 1 ? allChapters[currentGlobalIndex + 1] : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id, etapaIndex]);

  if (!section || !etapa) {
    return <div className="p-8 text-center">Capítulo no encontrado</div>;
  }

  const handleNavigateTool = (chapterNumber: number | string) => {
    console.log("handleNavigateTool called with:", chapterNumber);
    // Extract numbers allowing decimals, e.g. "10.1"
    const numMatch = String(chapterNumber).match(/[\d.]+/);
    let num = numMatch ? numMatch[0] : String(chapterNumber);
    
    // If it ends with a dot, remove it for safety
    if (num.endsWith('.')) {
      num = num.slice(0, -1);
    }
    
    const targetChapter = allChapters.find(c => {
      const matchTextEs = c.etapa.title.es.includes(`${num}. `) || c.etapa.title.es.startsWith(`${num}.`);
      const matchTextCa = c.etapa.title.ca.includes(`${num}. `) || c.etapa.title.ca.startsWith(`${num}.`);
      return matchTextEs || matchTextCa;
    });

    if (targetChapter) {
      console.log("Navigating to chapter:", targetChapter);
      navigate(`/section/${targetChapter.sectionId}?etapa=${targetChapter.index}`);
      return targetChapter.etapa.content[language];
    } else {
      console.warn("Chapter not found for number:", chapterNumber, "num computed:", num);
      const fallback = allChapters.find(c => c.etapa.title.es.includes(num));
      if (fallback) {
        console.log("Navigating to fallback:", fallback);
        navigate(`/section/${fallback.sectionId}?etapa=${fallback.index}`);
        return fallback.etapa.content[language];
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] flex flex-col">
      {/* Floating Controls */}
      <Link 
        to="/"
        className="fixed top-4 left-4 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-white/50 backdrop-blur-md border border-[var(--color-brand-heading)]/20 shadow-md transition-all duration-300 hover:shadow-lg hover:bg-white/80 text-[var(--color-brand-heading)]"
        aria-label="Atrás"
      >
        <ArrowLeft size={24} />
      </Link>
      
      <LanguageSelector />

      {/* Main Content */}
      <main className="flex-grow pb-16">
        <article className="mb-8 relative">
          {/* Cabecera de la etapa: Full width image with gradient fade at bottom */}
          {etapa.image && (
            <div className="relative w-full h-[85vh] md:h-[95vh] mb-12">
              <img 
                src={etapa.image} 
                alt={etapa.title[language]} 
                className="w-full h-full object-cover object-top"
              />
              {/* Difuminado inferior */}
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--color-brand-bg)] to-transparent pointer-events-none" />
            </div>
          )}

          {/* Contenido de la etapa */}
          <div className={`max-w-3xl mx-auto px-6 relative z-10 ${!etapa.image ? 'pt-32' : ''}`}>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-12">
              <h1 className="text-2xl md:text-4xl font-bold text-center text-[var(--color-brand-heading)] drop-shadow-sm leading-tight m-0">
                {etapa.title[language]}
              </h1>
            </div>
            
            <div className="max-w-none text-justify mt-8 
              text-base md:text-lg
              leading-relaxed
              [&>p]:mb-6
              [&>h1]:text-3xl [&>h1]:mb-6 [&>h1]:font-bold [&>h1]:text-[var(--color-brand-heading)]
              [&>h2]:text-2xl [&>h2]:mb-4 [&>h2]:font-bold [&>h2]:text-[var(--color-brand-heading)]
              [&>h3]:text-xl [&>h3]:mb-4 [&>h3]:font-bold [&>h3]:text-[var(--color-brand-heading)]
              [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-6
              [&>li]:mb-2
              [&>blockquote]:border-l-4 [&>blockquote]:border-[var(--color-brand-heading)] [&>blockquote]:pl-6 [&>blockquote]:italic [&>blockquote]:my-8 [&>blockquote]:opacity-90
              [&>strong]:text-[var(--color-brand-heading)]
              [&>a]:text-[var(--color-brand-heading)] [&>a]:underline
            ">
              <Markdown rehypePlugins={[rehypeSlug]}>{etapa.content[language]}</Markdown>
            </div>
          </div>
        </article>
      </main>

      {/* Footer Navigation */}
      <footer className="max-w-4xl mx-auto w-full px-6 py-12 border-t border-[var(--color-brand-heading)]/10 flex items-center justify-between mt-auto">
        {prevChapter ? (
          <Link 
            to={`/section/${prevChapter.sectionId}?etapa=${prevChapter.index}`}
            className="flex flex-col items-center justify-center p-4 rounded-full transition-all duration-300 hover:bg-black/5 hover:shadow-md text-[var(--color-brand-heading)] group"
            title="Capítulo Anterior"
          >
            <div className="w-14 h-14 rounded-full border border-[var(--color-brand-heading)]/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <ChevronLeft size={28} />
            </div>
            <span className="text-xs uppercase tracking-widest hidden sm:block">Anterior</span>
          </Link>
        ) : <div className="w-20" />}

        <Link 
          to="/"
          className="flex flex-col items-center justify-center p-4 rounded-full transition-all duration-300 hover:bg-black/5 hover:shadow-md text-[var(--color-brand-heading)] group"
          title="Índice de contenidos"
        >
          <div className="w-16 h-16 rounded-full border border-[var(--color-brand-heading)]/30 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform bg-[var(--color-brand-bg)] shadow-sm">
            <HomeIcon size={28} />
          </div>
          <span className="text-xs uppercase tracking-widest hidden sm:block">Índice</span>
        </Link>

        {nextChapter ? (
          <Link 
            to={`/section/${nextChapter.sectionId}?etapa=${nextChapter.index}`}
            className="flex flex-col items-center justify-center p-4 rounded-full transition-all duration-300 hover:bg-black/5 hover:shadow-md text-[var(--color-brand-heading)] group"
            title="Siguiente Capítulo"
          >
            <div className="w-14 h-14 rounded-full border border-[var(--color-brand-heading)]/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <ChevronRight size={28} />
            </div>
            <span className="text-xs uppercase tracking-widest hidden sm:block">Siguiente</span>
          </Link>
        ) : <div className="w-20" />}
      </footer>
    </div>
  );
}
