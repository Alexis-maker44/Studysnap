import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CheckCircle2, XCircle, AlertCircle, Timer, ChevronRight, ChevronLeft, 
  RefreshCw, Award, BookOpen, Sparkles, Upload, BarChart2, Home, Brain, 
  Volume2, Camera, Folder, Trash2, Plus, Zap, Heart, Play, HelpCircle
} from 'lucide-react';

// --- LISTE DES MOTS À EXCLURE (ANTI-BRUIT) ---
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'ce', 'cette', 'ces',
  'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses', 'nos', 'vos', 'leurs',
  'qui', 'que', 'quoi', 'dont', 'où', 'quand', 'comment', 'pourquoi', 'quel', 'quelle', 'quels', 'quelles',
  'est', 'sont', 'a', 'ont', 'fait', 'fais', 'font', 'pour', 'dans', 'sur', 'avec', 'sans', 'par', 'pour',
  'et', 'ou', 'mais', 'donc', 'car', 'ni', 'or', 'plus', 'moins', 'tres', 'aussi', 'bien', 'autre', 'aux'
]);

const speakText = (text) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
  }
};

// --- NETTOYAGE ROBUSTE DU TEXTE (OCR & PDF) ---
function cleanExtractedText(rawText) {
  if (!rawText) return [];

  return rawText
    // Supprime les caractères non lisibles d'OCR
    .replace(/[^\w\sàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ.,;:!?'"-]/g, ' ')
    .split(/(?:[.!?\n]+)/)
    .map((sentence) => sentence.replace(/^[-•*0-9.]+\s*/, '').trim())
    .filter((sentence) => {
      // Filtrer les bribes de phrases trop courtes ou sans mots pertinents
      const words = sentence.split(/\s+/).filter(w => w.length > 2);
      return sentence.length >= 25 && words.length >= 4;
    });
}

// --- EXTRACTEUR DE CONCEPTS CLES (VALIDES SEULEMENT) ---
function extractKeyConcept(sentence) {
  const cleanSentence = sentence.replace(/[,;:!?()]/g, '');
  const words = cleanSentence.split(/\s+/);

  // Chercher un mot long (>= 5 lettres) qui n'est pas dans les STOP_WORDS
  const validWords = words.filter((w) => {
    const lower = w.toLowerCase();
    return w.length >= 5 && !STOP_WORDS.has(lower) && !/^\d+$/.test(w);
  });

  return validWords.length > 0 ? validWords[0] : null;
}

// --- MOTEUR DE GÉNÉRATION INTELLIGENT ET FILTRÉ ---
function generateAllExercisesFromText(sourceText) {
  const cleanSentences = cleanExtractedText(sourceText);

  const generatedQuestions = [];
  const generatedFlashcards = [];
  const generatedFillBlanks = [];

  cleanSentences.forEach((sentence, index) => {
    // 1. Détection des définitions explicites (ex: "Le hook useState permet de...")
    const defMatch = sentence.match(/^(.{3,40}?)\s+(est|sont|désigne|représente|permet de|signifie|consiste à)\s+(.+)/i);

    if (defMatch) {
      const subject = defMatch[1].trim().replace(/^(Le|La|Les|Un|Une|L'|Le concept de)\s+/i, '');
      const definition = defMatch[3].trim();

      // Vérifier que le sujet n'est pas un mot parasite
      if (subject.length >= 3 && !STOP_WORDS.has(subject.toLowerCase()) && definition.length >= 10) {
        
        // Flashcard propre
        generatedFlashcards.push({
          id: generatedFlashcards.length + 1,
          front: subject.charAt(0).toUpperCase() + subject.slice(1),
          back: definition.charAt(0).toUpperCase() + definition.slice(1)
        });

        // QCM avec propositions sensées
        const correctText = definition;
        const wrongOptions = [
          `Un mécanisme indépendant non lié à ${subject}.`,
          `Un comportement obsolète dans ce contexte.`,
          `Une erreur de formulation courante.`
        ];
        const allOptions = [correctText, ...wrongOptions].sort(() => Math.random() - 0.5);

        generatedQuestions.push({
          id: generatedQuestions.length + 1,
          question: `Quelle est la fonction ou définition de « ${subject} » ?`,
          options: allOptions,
          correctAnswer: allOptions.indexOf(correctText),
          explanation: sentence
        });

        // Phrase à trous sur un vrai mot-clé
        const keyConcept = extractKeyConcept(sentence) || subject;
        const sentenceWithBlank = sentence.replace(new RegExp(`\\b${keyConcept}\\b`, 'gi'), '[___]');

        if (sentenceWithBlank !== sentence) {
          generatedFillBlanks.push({
            id: generatedFillBlanks.length + 1,
            sentenceWithBlank,
            missingWord: keyConcept,
            explanation: sentence
          });
        }
      }
    } else {
      // 2. Traitement pour phrases informelles avec mots-clés riches
      const keyConcept = extractKeyConcept(sentence);

      if (keyConcept && generatedQuestions.length < 8) {
        generatedFlashcards.push({
          id: generatedFlashcards.length + 1,
          front: keyConcept.charAt(0).toUpperCase() + keyConcept.slice(1),
          back: sentence
        });

        const sentenceWithBlank = sentence.replace(new RegExp(`\\b${keyConcept}\\b`, 'gi'), '[___]');
        if (sentenceWithBlank !== sentence) {
          generatedFillBlanks.push({
            id: generatedFillBlanks.length + 1,
            sentenceWithBlank,
            missingWord: keyConcept,
            explanation: sentence
          });
        }

        const correctText = sentence;
        const wrongOptions = [
          "Cette affirmation est contredite par le cours.",
          "Information non pertinente par rapport au sujet.",
          "Aucune de ces propositions n'est exacte."
        ];
        const allOptions = [correctText, ...wrongOptions].sort(() => Math.random() - 0.5);

        generatedQuestions.push({
          id: generatedQuestions.length + 1,
          question: `Quelle affirmation est exacte concernant « ${keyConcept} » ?`,
          options: allOptions,
          correctAnswer: allOptions.indexOf(correctText),
          explanation: sentence
        });
      }
    }
  });

  // Sécurité par défaut si le texte est illisible ou trop court
  const defaultFallbackQ = [
    {
      id: 1,
      question: "Exemple : Quelle est la meilleure approche de révision ?",
      options: ["Réviser activement avec des Quiz", "Lire passivement sans pratiquer", "Apprendre par cœur sans comprendre", "Ignorer les retours d'erreurs"],
      correctAnswer: 0,
      explanation: "La révision active permet une meilleure rétention en mémoire."
    }
  ];

  const defaultFallbackFc = [
    { id: 1, front: "Rappel", back: "Veuillez fournir un texte avec des phrases complètes pour générer des exercices sur-mesure." }
  ];

  const defaultFallbackFb = [
    { id: 1, sentenceWithBlank: "La révision [___] est plus efficace.", missingWord: "active", explanation: "L'apprentissage actif stimule la mémoire." }
  ];

  return {
    questions: generatedQuestions.length > 0 ? generatedQuestions : defaultFallbackQ,
    flashcards: generatedFlashcards.length > 0 ? generatedFlashcards : defaultFallbackFc,
    fillBlanks: generatedFillBlanks.length > 0 ? generatedFillBlanks : defaultFallbackFb
  };
}

function buildSessionSteps(questions, flashcards, fillBlanks) {
  const steps = [];

  // 1. Découverte (Flashcards)
  flashcards.slice(0, 3).forEach((fc) => {
    steps.push({ type: 'flashcard', data: fc });
  });

  // 2. Entraînement mixé (QCM + Trous)
  const maxInter = Math.max(questions.length, fillBlanks.length);
  for (let i = 0; i < maxInter; i++) {
    if (questions[i]) steps.push({ type: 'quiz', data: questions[i] });
    if (fillBlanks[i]) steps.push({ type: 'fillblank', data: fillBlanks[i] });
  }

  return steps;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  
  const [subjectList, setSubjectList] = useState(['React / Web', 'Histoire', 'Mathématiques']);
  const [selectedSubject, setSelectedSubject] = useState('React / Web');
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [savedDecks, setSavedDecks] = useState([]);

  const [questions, setQuestions] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [fillBlanks, setFillBlanks] = useState([]);
  const [rawInputText, setRawInputText] = useState('');

  // GAMIFICATION
  const [sessionSteps, setSessionSteps] = useState([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [isSessionFinished, setIsSessionFinished] = useState(false);

  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [userBlankInput, setUserBlankInput] = useState('');
  const [stepResultState, setStepResultState] = useState(null);
  const [timeLeft, setTimeLeft] = useState(25);
  const [isTimerActive, setIsTimerActive] = useState(false);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);

  const [uploadError, setUploadError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('studysnap_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      const savedSubjects = localStorage.getItem('studysnap_subjects');
      if (savedSubjects) setSubjectList(JSON.parse(savedSubjects));

      const decks = localStorage.getItem('studysnap_decks');
      if (decks) setSavedDecks(JSON.parse(decks));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveHistory = useCallback((result) => {
    setHistory((prev) => {
      const updated = [result, ...prev];
      localStorage.setItem('studysnap_history', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleAddSubject = () => {
    if (newSubjectInput.trim() && !subjectList.includes(newSubjectInput.trim())) {
      const updated = [...subjectList, newSubjectInput.trim()];
      setSubjectList(updated);
      setSelectedSubject(newSubjectInput.trim());
      setNewSubjectInput('');
      localStorage.setItem('studysnap_subjects', JSON.stringify(updated));
    }
  };

  const saveDeckToStorage = (title, category, newQ, newFc, newFb) => {
    const newDeck = {
      id: Date.now(),
      title: title || `Cours du ${new Date().toLocaleDateString('fr-FR')}`,
      subject: category,
      date: new Date().toLocaleDateString('fr-FR'),
      questions: newQ,
      flashcards: newFc,
      fillBlanks: newFb
    };

    setSavedDecks((prev) => {
      const updated = [newDeck, ...prev];
      localStorage.setItem('studysnap_decks', JSON.stringify(updated));
      return updated;
    });
  };

  const startSession = useCallback((qList = questions, fcList = flashcards, fbList = fillBlanks) => {
    const steps = buildSessionSteps(qList, fcList, fbList);
    setSessionSteps(steps);
    setCurrentStepIdx(0);
    setLives(3);
    setScore(0);
    setCombo(0);
    setIsSessionFinished(false);
    setSelectedAnswer(null);
    setUserBlankInput('');
    setStepResultState(null);
    setTimeLeft(25);
    setIsTimerActive(true);
    setActiveTab('session');
  }, [questions, flashcards, fillBlanks]);

  const handleLoadDeck = (deck) => {
    setQuestions(deck.questions);
    setFlashcards(deck.flashcards);
    setFillBlanks(deck.fillBlanks);
    setSelectedSubject(deck.subject);
    startSession(deck.questions, deck.flashcards, deck.fillBlanks);
  };

  const handleDeleteDeck = (id) => {
    const updated = savedDecks.filter((d) => d.id !== id);
    setSavedDecks(updated);
    localStorage.setItem('studysnap_decks', JSON.stringify(updated));
  };

  const advanceToNextStep = useCallback(() => {
    if (currentStepIdx + 1 < sessionSteps.length && lives > 0) {
      setCurrentStepIdx((prev) => prev + 1);
      setSelectedAnswer(null);
      setUserBlankInput('');
      setStepResultState(null);
      setTimeLeft(25);
      setIsTimerActive(true);
    } else {
      setIsSessionFinished(true);
      setIsTimerActive(false);
      const totalSteps = sessionSteps.length;
      const percentage = Math.round((score / (totalSteps * 10)) * 100);
      saveHistory({
        date: new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        subject: selectedSubject,
        score,
        total: totalSteps * 10,
        percentage: Math.min(percentage, 100)
      });
    }
  }, [currentStepIdx, sessionSteps.length, lives, score, saveHistory, selectedSubject]);

  useEffect(() => {
    let timer;
    const currentStep = sessionSteps[currentStepIdx];
    
    if (isTimerActive && timeLeft > 0 && !isSessionFinished && activeTab === 'session' && currentStep?.type !== 'flashcard') {
      timer = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    } else if (timeLeft === 0 && isTimerActive && !isSessionFinished && currentStep?.type !== 'flashcard') {
      setLives((l) => Math.max(0, l - 1));
      setCombo(0);
      setStepResultState('incorrect');
      setIsTimerActive(false);
    }
    return () => clearInterval(timer);
  }, [isTimerActive, timeLeft, isSessionFinished, activeTab, currentStepIdx, sessionSteps]);

  const handleAnswerSelect = (idx) => {
    if (selectedAnswer !== null || stepResultState !== null) return;
    setSelectedAnswer(idx);
    setIsTimerActive(false);

    const currentStep = sessionSteps[currentStepIdx];
    if (idx === currentStep.data.correctAnswer) {
      setStepResultState('correct');
      setScore((s) => s + 10 + combo * 2);
      setCombo((c) => c + 1);
      speakText("Bravo !");
    } else {
      setStepResultState('incorrect');
      setLives((l) => Math.max(0, l - 1));
      setCombo(0);
      speakText("Dommage !");
    }
  };

  const handleCheckFillBlank = () => {
    if (stepResultState !== null) return;
    setIsTimerActive(false);

    const currentStep = sessionSteps[currentStepIdx];
    if (userBlankInput.trim().toLowerCase() === currentStep.data.missingWord.toLowerCase()) {
      setStepResultState('correct');
      setScore((s) => s + 10 + combo * 2);
      setCombo((c) => c + 1);
      speakText("Excellente réponse !");
    } else {
      setStepResultState('incorrect');
      setLives((l) => Math.max(0, l - 1));
      setCombo(0);
      speakText("Incorrect. La réponse était " + currentStep.data.missingWord);
    }
  };

  const handleProcessText = (text) => {
    setUploadError(null);
    if (!text || !text.trim()) {
      setUploadError("Le texte fourni est trop court ou vide.");
      return;
    }
    setIsAnalyzing(true);
    setTimeout(() => {
      try {
        const generated = generateAllExercisesFromText(text);
        setQuestions(generated.questions);
        setFlashcards(generated.flashcards);
        setFillBlanks(generated.fillBlanks);

        saveDeckToStorage(
          text.slice(0, 25) + '...',
          selectedSubject,
          generated.questions,
          generated.flashcards,
          generated.fillBlanks
        );

        setIsAnalyzing(false);
        startSession(generated.questions, generated.flashcards, generated.fillBlanks);
      } catch (e) {
        console.error(e);
        setUploadError("Une erreur est survenue lors du filtrage du texte.");
        setIsAnalyzing(false);
      }
    }, 300);
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setUploadError("Impossible d'accéder à la caméra de l'appareil.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    stopCamera();
    processImageOCR(canvas.toDataURL('image/png'));
  };

  const processImageOCR = async (imageSrc) => {
    setIsAnalyzing(true);
    setOcrProgress("Extraction & Filtrage intelligent de la photo...");

    try {
      if (!window.Tesseract) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        document.head.appendChild(script);
        await new Promise((resolve) => (script.onload = resolve));
      }

      const worker = await window.Tesseract.createWorker('fra');
      const ret = await worker.recognize(imageSrc);
      await worker.terminate();

      const text = ret.data.text;
      if (!text || !text.trim()) throw new Error("Aucun texte lisible trouvé.");

      setRawInputText(text);
      setOcrProgress('');
      handleProcessText(text);
    } catch (err) {
      setUploadError(err.message || "Erreur lors de la numérisation.");
      setIsAnalyzing(false);
      setOcrProgress('');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    setUploadError(null);
    if (!file) return;

    setIsAnalyzing(true);

    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        setOcrProgress("Extraction & Filtrage du PDF...");
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          document.head.appendChild(script);
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tokenized = await page.getTextContent();
          fullText += tokenized.items.map((item) => item.str).join(' ') + '\n';
        }

        if (!fullText.trim()) throw new Error("Le PDF ne contient pas de texte lisible.");

        setRawInputText(fullText);
        setOcrProgress('');
        handleProcessText(fullText);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => processImageOCR(e.target.result);
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          setRawInputText(e.target?.result);
          handleProcessText(e.target?.result);
        };
        reader.readAsText(file);
      }
    } catch (err) {
      setUploadError(err.message || "Erreur lors du traitement.");
      setIsAnalyzing(false);
      setOcrProgress('');
    }
  };

  const currentStep = sessionSteps[currentStepIdx];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('home')}>
          <Brain className="w-8 h-8 text-amber-300" />
          <h1 className="text-xl font-bold tracking-wide">StudySnap <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded-full ml-1">v3.1</span></h1>
        </div>
        <nav className="flex space-x-2">
          <button onClick={() => setActiveTab('home')} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'home' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Home className="w-4 h-4" /> <span className="hidden md:inline">Accueil</span>
          </button>
          <button onClick={() => startSession()} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'session' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Play className="w-4 h-4" /> <span className="hidden md:inline">Révision Active</span>
          </button>
          <button onClick={() => setActiveTab('decks')} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'decks' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Folder className="w-4 h-4" /> <span className="hidden md:inline">Mes Decks</span>
          </button>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-6">
        {/* ACCUEIL */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900">Importation intelligente du cours</h2>
                <p className="text-slate-600 text-sm mt-1">Le texte est filtré automatiquement pour éliminer le bruit et créer des exercices sensés.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">1. Choisir ou créer une matière</label>
                <div className="flex space-x-2">
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {subjectList.map((subj, idx) => (
                      <option key={idx} value={subj}>{subj}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newSubjectInput}
                    onChange={(e) => setNewSubjectInput(e.target.value)}
                    placeholder="Nouvelle matière..."
                    className="p-2.5 border border-slate-200 rounded-xl text-sm w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button onClick={handleAddSubject} className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 my-2"></div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">2. Numériser votre document (PDF / Photo)</label>
                {isCameraActive ? (
                  <div className="space-y-2 text-center">
                    <video ref={videoRef} autoPlay playsInline className="w-full max-h-64 object-cover rounded-xl border-2 border-indigo-500" />
                    <div className="flex justify-center space-x-2">
                      <button onClick={capturePhoto} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center space-x-1">
                        <Camera className="w-4 h-4" /> <span>Prendre la photo</span>
                      </button>
                      <button onClick={stopCamera} className="bg-slate-300 hover:bg-slate-400 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button onClick={startCamera} className="p-4 border-2 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/50 rounded-xl flex flex-col items-center justify-center transition">
                      <Camera className="w-6 h-6 text-indigo-600 mb-1" />
                      <span className="text-sm font-semibold text-indigo-900">Prendre une photo du cours</span>
                    </button>
                    <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/20 hover:border-indigo-400 rounded-xl p-4 relative text-center flex flex-col items-center justify-center cursor-pointer">
                      <input type="file" onChange={handleFileUpload} accept=".pdf,image/*,.txt,.json" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <Upload className="w-6 h-6 text-indigo-500 mb-1" />
                      <span className="text-sm font-semibold text-slate-700">Importer PDF ou Image</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">3. Ou copier-coller votre texte</label>
                <textarea
                  value={rawInputText}
                  onChange={(e) => setRawInputText(e.target.value)}
                  placeholder="Collez le texte du cours ici..."
                  rows={3}
                  className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  onClick={() => handleProcessText(rawInputText)}
                  disabled={!rawInputText.trim() || isAnalyzing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition flex items-center justify-center space-x-2 shadow-sm"
                >
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>{isAnalyzing ? (ocrProgress || "Filtrage & Génération...") : "Lancer le Parcours de Révision"}</span>
                </button>
              </div>

              {uploadError && (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PARCOURS GAMIFIÉ */}
        {activeTab === 'session' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            {!isSessionFinished && currentStep ? (
              <div>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <div className="flex items-center space-x-2">
                      <span className="text-indigo-600 font-bold">Étape {currentStepIdx + 1} / {sessionSteps.length}</span>
                      {combo > 1 && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <Zap className="w-3 h-3 fill-amber-500" /> <span>Combo x{combo}</span>
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="flex space-x-1">
                        {[1, 2, 3].map((heart) => (
                          <Heart key={heart} className={`w-5 h-5 ${heart <= lives ? 'text-red-500 fill-red-500' : 'text-slate-200'}`} />
                        ))}
                      </div>

                      <div className="flex items-center space-x-1 text-slate-700 font-mono">
                        <Award className="w-4 h-4 text-indigo-600" />
                        <span>{score} pts</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${((currentStepIdx + 1) / sessionSteps.length) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* FLASHCARD */}
                {currentStep.type === 'flashcard' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1 rounded-full flex items-center space-x-1">
                        <HelpCircle className="w-3.5 h-3.5" /> <span>Découverte / Rappel</span>
                      </span>
                      <button onClick={() => speakText(`${currentStep.data.front} : ${currentStep.data.back}`)} className="p-1.5 text-slate-500 hover:text-indigo-600">
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border-2 border-indigo-100 rounded-2xl p-6 min-h-56 flex flex-col items-center justify-center text-center select-none">
                      <h3 className="text-xl font-bold text-slate-900 mb-3">{currentStep.data.front}</h3>
                      <p className="text-slate-700 text-sm max-w-lg leading-relaxed">{currentStep.data.back}</p>
                    </div>

                    <div className="flex justify-end">
                      <button onClick={advanceToNextStep} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl flex items-center space-x-2 transition">
                        <span>J'ai compris !</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* QCM */}
                {currentStep.type === 'quiz' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">Question QCM</span>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => speakText(currentStep.data.question)} className="p-1.5 text-slate-500 hover:text-indigo-600">
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center space-x-1 text-slate-500 text-xs font-mono font-bold">
                          <Timer className="w-3.5 h-3.5" />
                          <span className={timeLeft < 8 ? 'text-red-500' : ''}>{timeLeft}s</span>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold text-slate-800">{currentStep.data.question}</h3>

                    <div className="space-y-2.5">
                      {currentStep.data.options.map((option, idx) => {
                        let btnStyle = "border-slate-200 hover:border-indigo-300 hover:bg-slate-50";
                        if (stepResultState !== null) {
                          if (idx === currentStep.data.correctAnswer) btnStyle = "border-green-500 bg-green-50 text-green-800 font-medium";
                          else if (idx === selectedAnswer) btnStyle = "border-red-500 bg-red-50 text-red-700";
                        }
                        return (
                          <button
                            key={idx}
                            disabled={stepResultState !== null}
                            onClick={() => handleAnswerSelect(idx)}
                            className={`w-full text-left p-3.5 border-2 rounded-xl transition flex justify-between items-center text-sm ${btnStyle}`}
                          >
                            <span>{option}</span>
                            {stepResultState !== null && idx === currentStep.data.correctAnswer && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                            {stepResultState !== null && idx === selectedAnswer && idx !== currentStep.data.correctAnswer && <XCircle className="w-5 h-5 text-red-500" />}
                          </button>
                        );
                      })}
                    </div>

                    {stepResultState !== null && (
                      <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100">
                        <p className="font-semibold text-slate-800 mb-1">Explication :</p>
                        {currentStep.data.explanation}
                      </div>
                    )}

                    {stepResultState !== null && (
                      <div className="flex justify-end">
                        <button onClick={advanceToNextStep} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl flex items-center space-x-2 transition">
                          <span>Suivant</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TROUS */}
                {currentStep.type === 'fillblank' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold bg-purple-50 text-purple-700 px-3 py-1 rounded-full">Mot Manquant</span>
                      <button onClick={() => speakText(currentStep.data.sentenceWithBlank)} className="p-1.5 text-slate-500 hover:text-indigo-600">
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-2xl text-center space-y-4">
                      <p className="text-base font-medium text-slate-800">{currentStep.data.sentenceWithBlank}</p>
                      <input
                        type="text"
                        value={userBlankInput}
                        onChange={(e) => setUserBlankInput(e.target.value)}
                        disabled={stepResultState !== null}
                        placeholder="Tapez la réponse..."
                        className="w-full max-w-xs p-3 text-center border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    {stepResultState === 'correct' && <div className="p-3 bg-green-50 text-green-700 rounded-xl text-sm font-semibold">Excellente réponse ! 🎉</div>}
                    {stepResultState === 'incorrect' && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm font-semibold">Incorrect. La réponse était : <b>{currentStep.data.missingWord}</b></div>}

                    <div className="flex justify-end space-x-2">
                      {stepResultState === null ? (
                        <button onClick={handleCheckFillBlank} disabled={!userBlankInput.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium transition">
                          Vérifier
                        </button>
                      ) : (
                        <button onClick={advanceToNextStep} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition flex items-center space-x-1">
                          <span>Suivant</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 space-y-6">
                <Award className="w-16 h-16 text-amber-500 mx-auto" />
                <h2 className="text-2xl font-bold text-slate-800">
                  {lives > 0 ? "Session terminée !" : "Plus de vies disponible !"}
                </h2>
                
                <div className="bg-indigo-50 p-6 rounded-2xl inline-block space-y-2">
                  <p className="text-3xl font-extrabold text-indigo-600">{score} points</p>
                  <p className="text-xs text-slate-600">Matière : <b>{selectedSubject}</b></p>
                </div>

                <div className="flex justify-center space-x-3">
                  <button onClick={() => startSession()} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium flex items-center space-x-2 hover:bg-indigo-700 transition">
                    <RefreshCw className="w-4 h-4" /> <span>Recommencer la session</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MES DECKS */}
        {activeTab === 'decks' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Mes Decks Enregistrés</h2>
              {savedDecks.length === 0 ? (
                <p className="text-slate-500 text-sm">Aucun deck sauvegardé. Importez un cours pour démarrer.</p>
              ) : (
                <div className="space-y-3">
                  {savedDecks.map((deck) => (
                    <div key={deck.id} className="p-4 border border-slate-200 rounded-xl flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition">
                      <div>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">{deck.subject}</span>
                        <h4 className="text-sm font-semibold text-slate-800 mt-1">{deck.title}</h4>
                        <p className="text-xs text-slate-400">Créé le {deck.date} • {deck.questions.length} étapes</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleLoadDeck(deck)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center space-x-1">
                          <Play className="w-3.5 h-3.5" /> <span>Lancer</span>
                        </button>
                        <button onClick={() => handleDeleteDeck(deck.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Historique des scores</h2>
              {history.length === 0 ? (
                <p className="text-slate-500 text-sm">Aucun résultat récent.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {history.map((item, idx) => (
                    <div key={idx} className="py-3 flex justify-between items-center text-sm">
                      <div>
                        <span className="text-xs font-medium text-slate-500">{item.subject || 'Général'}</span>
                        <p className="font-medium text-slate-800">{item.date}</p>
                      </div>
                      <span className="font-bold text-indigo-600">{item.score} pts ({item.percentage}%)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
