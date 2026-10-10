import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CheckCircle2, XCircle, AlertCircle, Timer, ChevronRight, ChevronLeft, 
  RefreshCw, Award, BookOpen, Sparkles, Upload, BarChart2, Home, Brain, 
  Volume2, Camera, Folder, Trash2, Plus, Zap, Heart, Play, HelpCircle
} from 'lucide-react';

// --- DONNÉES PAR DÉFAUT ---
const DEFAULT_QUESTIONS = [
  {
    id: 1,
    question: "Quelle est la principale fonction d'un hook useState en React ?",
    options: [
      "Gérer les effets secondaires",
      "Ajouter un état local à un composant fonctionnel",
      "Optimiser les performances de rendu",
      "Créer un contexte global"
    ],
    correctAnswer: 1,
    explanation: "useState permet d'ajouter un état local à un composant fonctionnel React."
  },
  {
    id: 2,
    question: "Quel hook est utilisé pour exécuter du code après le rendu ?",
    options: ["useMemo", "useCallback", "useEffect", "useRef"],
    correctAnswer: 2,
    explanation: "useEffect s'exécute après le rendu pour gérer les effets secondaires."
  }
];

const DEFAULT_FLASHCARDS = [
  { id: 1, front: "JSX", back: "Extension de syntaxe JavaScript permettant d'écrire du HTML dans React." },
  { id: 2, front: "Props", back: "Arguments et données transmis de composant en composant." }
];

const DEFAULT_FILLBLANKS = [
  {
    id: 1,
    sentenceWithBlank: "Le hook [___] permet d'ajouter un état local à un composant fonctionnel.",
    missingWord: "useState",
    explanation: "useState est le hook d'état de base."
  }
];

const speakText = (text) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
  }
};

// --- MOTEUR DE GÉNÉRATION D'EXERCICES (UNIFIÉ) ---
function generateAllExercisesFromText(sourceText) {
  const rawLines = sourceText
    .split(/(?:\r?\n)+/)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter((l) => l.length > 5);

  const rawSentences = sourceText
    .split(/(?:[.!?\n]+)/)
    .map((s) => s.replace(/^[-•*]\s*/, '').trim())
    .filter((s) => s.length > 15);

  const generatedQuestions = [];
  const generatedFlashcards = [];
  const generatedFillBlanks = [];

  // 1. Détection des lignes structurées (Terme : Définition)
  rawLines.forEach((line) => {
    const colonMatch = line.match(/^(.+?)\s*[:=–-]\s*(.+)$/);
    if (colonMatch) {
      const term = colonMatch[1].trim();
      const def = colonMatch[2].trim();

      if (term.length > 1 && term.length < 40 && def.length > 5) {
        generatedFlashcards.push({
          id: generatedFlashcards.length + 1,
          front: term,
          back: def
        });

        generatedFillBlanks.push({
          id: generatedFillBlanks.length + 1,
          sentenceWithBlank: `${term} : [___]`,
          missingWord: def.split(' ')[0],
          explanation: line
        });
      }
    }
  });

  // 2. Détection des définitions par verbes pivots
  rawSentences.forEach((sentence) => {
    const defMatch = sentence.match(/(.+?)\s+(est|sont|désigne|représente|permet de|signifie|consiste à)\s+(.+)/i);

    if (defMatch) {
      const subject = defMatch[1].trim();
      const definition = defMatch[3].trim();

      if (subject.length > 2 && subject.length < 45 && definition.length > 10) {
        if (!generatedFlashcards.some(f => f.front.toLowerCase() === subject.toLowerCase())) {
          generatedFlashcards.push({
            id: generatedFlashcards.length + 1,
            front: subject,
            back: definition.charAt(0).toUpperCase() + definition.slice(1)
          });
        }

        const correctText = definition;
        const wrongOptions = [
          `Une méthode alternative non liée à ${subject}.`,
          `Un concept obsolète dans ce domaine.`,
          `Une erreur de configuration fréquente.`
        ];
        const allOptions = [correctText, ...wrongOptions].sort(() => Math.random() - 0.5);

        generatedQuestions.push({
          id: generatedQuestions.length + 1,
          question: `Quelle est la définition exacte du concept « ${subject} » ?`,
          options: allOptions,
          correctAnswer: allOptions.indexOf(correctText),
          explanation: sentence
        });

        const sentenceWithBlank = sentence.replace(new RegExp(subject, 'gi'), '[___]');
        if (sentenceWithBlank !== sentence) {
          generatedFillBlanks.push({
            id: generatedFillBlanks.length + 1,
            sentenceWithBlank,
            missingWord: subject,
            explanation: sentence
          });
        }
      }
    }
  });

  // 3. Secours universel si le texte est dense ou informel
  if (generatedFlashcards.length < 2 && rawSentences.length > 0) {
    rawSentences.slice(0, 5).forEach((sentence, i) => {
      const words = sentence.split(' ');
      const keyWord = words.find((w) => w.length > 5) || words[0] || 'Point clé';
      const cleanKey = keyWord.replace(/[,.;:!?()]/g, '');

      generatedFlashcards.push({
        id: i + 1,
        front: cleanKey,
        back: sentence
      });

      generatedFillBlanks.push({
        id: i + 1,
        sentenceWithBlank: sentence.replace(cleanKey, '[___]'),
        missingWord: cleanKey,
        explanation: sentence
      });

      const correctText = sentence;
      const wrongOptions = [
        "Cette affirmation est fausse d'après le cours.",
        "Information non mentionnée dans le document.",
        "Aucune de ces propositions."
      ];
      const allOptions = [correctText, ...wrongOptions].sort(() => Math.random() - 0.5);

      generatedQuestions.push({
        id: i + 1,
        question: `À quoi correspond « ${cleanKey} » dans le cours ?`,
        options: allOptions,
        correctAnswer: allOptions.indexOf(correctText),
        explanation: sentence
      });
    });
  }

  return {
    questions: generatedQuestions.length > 0 ? generatedQuestions : DEFAULT_QUESTIONS,
    flashcards: generatedFlashcards.length > 0 ? generatedFlashcards : DEFAULT_FLASHCARDS,
    fillBlanks: generatedFillBlanks.length > 0 ? generatedFillBlanks : DEFAULT_FILLBLANKS
  };
}

// --- CONTEXTUALISATION & MISA EN SÉQUENCE DES ÉTAPES ---
function buildSessionSteps(questions, flashcards, fillBlanks) {
  const steps = [];

  // Étape 1 : Découverte avec Flashcards
  flashcards.slice(0, 3).forEach((fc) => {
    steps.push({ type: 'flashcard', data: fc });
  });

  // Étape 2 & 3 : Alternance QCM et Phrases à trous
  const maxInter = Math.max(questions.length, fillBlanks.length);
  for (let i = 0; i < maxInter; i++) {
    if (questions[i]) steps.push({ type: 'quiz', data: questions[i] });
    if (fillBlanks[i]) steps.push({ type: 'fillblank', data: fillBlanks[i] });
  }

  return steps;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'session' | 'decks'
  
  // Matières et Decks
  const [subjectList, setSubjectList] = useState(['React / Web', 'Histoire', 'Mathématiques']);
  const [selectedSubject, setSelectedSubject] = useState('React / Web');
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [savedDecks, setSavedDecks] = useState([]);

  // Données courantes du deck
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [flashcards, setFlashcards] = useState(DEFAULT_FLASHCARDS);
  const [fillBlanks, setFillBlanks] = useState(DEFAULT_FILLBLANKS);
  const [rawInputText, setRawInputText] = useState('');

  // SESSIONS GAMIFIÉES
  const [sessionSteps, setSessionSteps] = useState([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [isSessionFinished, setIsSessionFinished] = useState(false);

  // État local des étapes
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [userBlankInput, setUserBlankInput] = useState('');
  const [stepResultState, setStepResultState] = useState(null); // 'correct' | 'incorrect'
  const [timeLeft, setTimeLeft] = useState(25);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Caméra & OCR
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);

  const [uploadError, setUploadError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');
  const [history, setHistory] = useState([]);

  // Chargement des données locales
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

  // LANCER UNE SESSION GAMIFIÉE
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

  // PASSAGE À L'ÉTAPE SUIVANTE
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

  // CHRONOMÈTRE
  useEffect(() => {
    let timer;
    const currentStep = sessionSteps[currentStepIdx];
    
    // Le timer est désactivé sur les flashcards
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

  // VALIDATION QCM
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

  // VALIDATION PHRASE À TROUS
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
      speakText("Incorrect. C'était " + currentStep.data.missingWord);
    }
  };

  // TRAITEMENT DU TEXTE BRUT
  const handleProcessText = (text) => {
    setUploadError(null);
    if (!text || !text.trim()) {
      setUploadError("Le contenu du texte est vide.");
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
        setUploadError("Une erreur est survenue lors de l'analyse.");
        setIsAnalyzing(false);
      }
    }, 300);
  };

  // GESTION CAMÉRA & OCR
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
    setOcrProgress("Extraction du texte de la photo...");

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
      setUploadError(err.message || "Erreur de lecture de l'image.");
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
        setOcrProgress("Extraction du PDF...");
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

        if (!fullText.trim()) throw new Error("Le PDF ne contient pas de texte sélectable.");

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
      {/* HEADER */}
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('home')}>
          <Brain className="w-8 h-8 text-amber-300" />
          <h1 className="text-xl font-bold tracking-wide">StudySnap <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded-full ml-1">v3.0</span></h1>
        </div>
        <nav className="flex space-x-2">
          <button onClick={() => setActiveTab('home')} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'home' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Home className="w-4 h-4" /> <span className="hidden md:inline">Accueil</span>
          </button>
          <button onClick={() => startSession()} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'session' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Play className="w-4 h-4" /> <span className="hidden md:inline">Lancer la Révision</span>
          </button>
          <button onClick={() => setActiveTab('decks')} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'decks' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Folder className="w-4 h-4" /> <span className="hidden md:inline">Mes Decks</span>
          </button>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-6">
        {/* 1. ACCUEIL & NUMÉRISATION */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900">Importez votre cours pour démarrer</h2>
                <p className="text-slate-600 text-sm mt-1">Créez un parcours gamifié personnalisé en un clic.</p>
              </div>

              {/* Choix de la matière */}
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

              {/* Numérisation Photo / PDF */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">2. Scanner votre cours (PDF / Photo / Image)</label>
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
                      <span className="text-sm font-semibold text-slate-700">Importer PDF, Image ou Texte</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Texte direct */}
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
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition flex items-center justify-center space-x-2 text-base shadow-sm"
                >
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>{isAnalyzing ? (ocrProgress || "Génération du parcours...") : "Lancer le Parcours de Révision"}</span>
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

        {/* 2. MODE PARCOURS DE RÉVISION UNIFIÉ & GAMIFIÉ */}
        {activeTab === 'session' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            {!isSessionFinished && currentStep ? (
              <div>
                {/* BARRE DE PROGRESSION & STATS GAMIFIÉES */}
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
                      {/* Vies */}
                      <div className="flex space-x-1">
                        {[1, 2, 3].map((heart) => (
                          <Heart 
                            key={heart} 
                            className={`w-5 h-5 ${heart <= lives ? 'text-red-500 fill-red-500' : 'text-slate-200'}`} 
                          />
                        ))}
                      </div>

                      {/* Points */}
                      <div className="flex items-center space-x-1 text-slate-700 font-mono">
                        <Award className="w-4 h-4 text-indigo-600" />
                        <span>{score} pts</span>
                      </div>
                    </div>
                  </div>

                  {/* Barre de progression visuelle */}
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${((currentStepIdx + 1) / sessionSteps.length) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* --- SOUS-MODE 1 : FLASHCARD DE DÉCOUVERTE --- */}
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

                    <div 
                      onClick={() => setStepResultState('correct')}
                      className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border-2 border-indigo-100 rounded-2xl p-6 min-h-56 flex flex-col items-center justify-center text-center relative select-none cursor-pointer"
                    >
                      <h3 className="text-xl font-bold text-slate-900 mb-3">{currentStep.data.front}</h3>
                      <p className="text-slate-700 text-sm max-w-lg leading-relaxed">{currentStep.data.back}</p>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        onClick={advanceToNextStep}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl flex items-center space-x-2 transition"
                      >
                        <span>J'ai compris !</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* --- SOUS-MODE 2 : QUIZ / QCM --- */}
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

                {/* --- SOUS-MODE 3 : PHRASE À TROUS --- */}
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
              /* ÉCRAN DE BILAN DU PARCOURS */
              <div className="text-center py-6 space-y-6">
                <Award className="w-16 h-16 text-amber-500 mx-auto" />
                <h2 className="text-2xl font-bold text-slate-800">
                  {lives > 0 ? "Session terminée !" : "Oups ! Plus de vies."}
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

        {/* 3. MES DECKS & HISTORIQUE */}
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
