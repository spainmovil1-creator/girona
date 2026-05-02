import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { data } from '../data';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';

export default function Home() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const allChapters = data.flatMap(s => s.etapas.map((e, i) => ({ sectionId: s.id, etapa: e, index: i })));

  const handleNavigateTool = (chapterNumber: number | string) => {
    const numMatch = String(chapterNumber).match(/[\d.]+/);
    let num = numMatch ? numMatch[0] : String(chapterNumber);
    if (num.endsWith('.')) num = num.slice(0, -1);
    
    const targetChapter = allChapters.find(c => {
      const matchTextEs = c.etapa.title.es.includes(`${num}. `) || c.etapa.title.es.startsWith(`${num}.`);
      const matchTextCa = c.etapa.title.ca.includes(`${num}. `) || c.etapa.title.ca.startsWith(`${num}.`);
      return matchTextEs || matchTextCa;
    });

    if (targetChapter) {
      navigate(`/section/${targetChapter.sectionId}?etapa=${targetChapter.index}`);
      return targetChapter.etapa.content[language];
    } else {
      const fallback = allChapters.find(c => c.etapa.title.es.includes(num));
      if (fallback) {
        navigate(`/section/${fallback.sectionId}?etapa=${fallback.index}`);
        return fallback.etapa.content[language];
      }
    }
  };

  return (
    <div className="relative min-h-screen">
      <LanguageSelector />
      
      {/* Portada */}
      <div className="w-full flex flex-col justify-start bg-[var(--color-brand-bg)]">
        <picture className="block w-full">
          <img 
            src="/images/portadahorizontal.png" 
            alt="Girona panoramica" 
            className="w-full min-h-[75vh] md:min-h-[90vh] lg:min-h-screen object-cover object-top"
          />
        </picture>
      </div>

      {/* Catálogo de Secciones */}
      <main className="max-w-5xl mx-auto py-16 px-4 md:px-8 space-y-16">
        <div className="text-center mb-12 flex flex-col items-center justify-center">
          <h2 className="text-xl md:text-2xl font-bold mb-8 uppercase tracking-widest text-[var(--color-brand-heading)]">
            {language === 'es' ? 'Índice de Contenidos' : 'Índex de Continguts'}
          </h2>
        </div>

        <div className="flex flex-col gap-12">
          {data.map((section) => (
            <section 
              key={section.id} 
              className="bg-white/80 backdrop-blur-sm shadow-md border border-[var(--color-brand-heading)]/10 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl"
            >
              <div className="relative h-72 md:h-96 w-full">
                <img 
                  src={section.photo} 
                  alt={section.title[language]} 
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-brand-bg)]/90 via-transparent to-transparent pointer-events-none" />
                <h2 className="absolute bottom-6 left-6 right-6 text-2xl md:text-3xl font-bold text-[var(--color-brand-heading)]">
                  {section.title[language]}
                </h2>
              </div>

              <div className="p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {section.etapas.map((etapa, index) => (
                    <Link
                      key={etapa.id}
                      to={`/section/${section.id}?etapa=${index}`}
                      className="group block p-4 rounded-xl border border-transparent hover:border-[var(--color-brand-heading)]/20 hover:bg-black/5 transition-colors duration-300 shadow-sm hover:shadow-md bg-[var(--color-brand-bg)]"
                    >
                      <h3 className="text-base font-medium text-[var(--color-brand-text)] group-hover:text-[var(--color-brand-heading)] transition-colors">
                        {etapa.title[language]}
                      </h3>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
