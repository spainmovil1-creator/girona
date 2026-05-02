/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import SectionPage from './pages/SectionPage';
import VoiceAssistant from './components/VoiceAssistant';
import { data } from './data';

function GlobalVoiceAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();

  const allChapters = data.flatMap(s => s.etapas.map((e, i) => ({ sectionId: s.id, etapa: e, index: i })));

  let currentText = '';
  if (location.pathname === '/') {
    currentText = language === 'es' 
              ? '¡Hola! Soy tu asistente de voz experto en la historia de Girona. Como puedes ver, aquí tienes el índice con todas las secciones y capítulos que cubren desde la Girona ibérica hasta la actualidad. Puedes preguntarme sobre cualquiera de ellos y te ayudaré con mucho gusto.'
              : 'Hola! Sóc el teu assistent de veu expert en la història de Girona. Com pots veure, aquí tens l\'índex amb totes les seccions i capítols que cobreixen des de la Girona ibèrica fins a l\'actualitat. Pots preguntar-me sobre qualsevol d\'ells i t\'ajudaré amb molt de gust.';
  } else if (location.pathname.startsWith('/section/')) {
    const sectionId = location.pathname.split('/')[2];
    const params = new URLSearchParams(location.search);
    const etapaIndexStr = params.get('etapa');
    const etapaIndex = etapaIndexStr ? parseInt(etapaIndexStr, 10) : 0;
    const section = data.find(s => s.id === sectionId);
    if (section && section.etapas[etapaIndex]) {
       currentText = section.etapas[etapaIndex].content[language];
    }
  }

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

  const handleScroll = (targetId: string) => {
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const allElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, p, li'));
      const match = allElements.find(el => el.textContent?.toLowerCase().includes(targetId.toLowerCase()));
      if (match) {
        match.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <VoiceAssistant 
        text={currentText} 
        language={language} 
        onNavigate={handleNavigateTool} 
        onScroll={handleScroll} 
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/section/:id" element={<SectionPage />} />
        </Routes>
        <GlobalVoiceAssistant />
      </BrowserRouter>
    </LanguageProvider>
  );
}
