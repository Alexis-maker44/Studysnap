import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, XCircle, AlertCircle, Timer, ChevronRight, ChevronLeft, 
  RefreshCw, Award, BookOpen, Sparkles, Upload, FileText, Check, X, 
  Shuffle, BarChart2, Home, Plus, Brain, Volume2, Mic 
} from 'lucide-react';

// --- CHARGEMENT DYNAMIQUE DE PDF.JS VIA CDN ---
const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = () => reject(new Error("Impossible de charger la bibliothèque PDF.js"));
    document.head.appendChild(script);
  });
};

// --- EXTRACTION DU TEXTE D'UN FICHIER PDF ---
const extractTextFromPdf = async (file: File): Promise<string> => {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tokenized = await page.getTextContent();
    const pageText = tokenized.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
};

// --- TYPES ---
type ActiveTab = 'home' | 'quiz' | 'flashcards' | 'fillblank' | 'history';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface Flashcard {
  id: number;
  front: string;
  back: string;
}

interface FillInTheBlank {
  id: number;
  sentenceWithBlank: string;
  missingWord: string;
  explanation: string;
}

interface QuizResult {
  date: string;
  score: number;
  total: number;
  percentage: number;
}

// --- DONNÉES PAR DÉFAUT ---
const DEFAULT_QUESTIONS: Question[] = [
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

const DEFAULT_FLASHCARDS: Flashcard[] = [
  { id: 1, front: "JSX", back: "Extension de syntaxe JavaScript pour React" },
  { id: 2, front: "Props", back: "Arguments transmis aux composants React" }
];

const DEFAULT_FILLBLANKS: FillInTheBlank[] = [
  {
    id: 1,
    sentenceWithBlank: "Le hook [___] permet d'ajouter un état local à un composant fonctionnel.",
    missingWord: "useState",
    explanation: "useState est le hook d'état de base."
  }
];

// --- SYNTHÈSE VOCALE ---
const speakText = (text: string) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
  } else {
    alert("La synthèse vocale n'est pas supportée par votre navigateur.");
  }
};

// --- MOTEUR DE GÉNÉRATION D'EXERCICES (AVEC MÉLANGE ALÉATOIRE DES RÉPONSES) ---
function generateAllExercisesFromText(sourceText: string) {
  const rawSentences = sourceText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const generatedQuestions: Question[] = [];
  const generatedFlashcards: Flashcard[] = [];
  const generatedFillBlanks: FillInTheBlank[] = [];

  rawSentences.forEach((sentence, index) => {
    const match = sentence.match(/(.+?)\s+(est|sont|désigne|représente|permet de|s'explique par)\s+(.+)/i);

    if (match) {
      const subject = match[1].replace(/^[-•*]\s*/, '').trim();
      const definition = match[3].trim();

      // 1. Définir la bonne réponse et les distracteurs
      const correctText = definition;
      const wrongOptions = [
        `Une méthode alternative non liée à ${subject}.`,
        `Un concept obsolète dans ce domaine.`,
        `Une erreur de configuration fréquente.`
      ];

      // 2. Mélanger aléatoirement les propositions
      const allOptions = [correctText, ...wrongOptions].sort(() => Math.random() - 0.5);

      // 3. Récupérer le nouvel index de la bonne réponse
      const correctIndex = allOptions.indexOf(correctText);

      generatedQuestions.push({
        id: index + 1,
        question: `Que désigne le terme ou concept « ${subject} » ?`,
        options: allOptions,
        correctAnswer: correctIndex,
        explanation: sentence
      });

      // Flashcard
      generatedFlashcards.push({
        id: index + 1,
        front: subject,
        back: definition
      });

      // Phrase à trou
      if (subject.length > 3 && subject.length < 25) {
        const sentenceWithBlank = sentence.replace(new RegExp(subject, 'gi'), '[___]');
        if (sentenceWithBlank !== sentence) {
          generatedFillBlanks.push({
            id: index + 1,
            sentenceWithBlank,
            missingWord: subject,
            explanation: sentence
          });
        }
      }
    }
  });

  // Mode de secours si le texte manque de structures explicites
  if (generatedQuestions.length === 0 && rawSentences.length > 0) {
    rawSentences.slice(0, 5).forEach((sentence, i) => {
      generatedFlashcards.push({ id: i + 1, front: `Point clé n°${i + 1}`, back: sentence });
      
      const words = sentence.split(' ');
      const keyWord = words.find(w => w.length > 5) || words[0];
      
      generatedFillBlanks.push({
        id: i + 1,
        sentenceWithBlank: sentence.replace(keyWord, '[___]'),
        missingWord: keyWord.replace(/[,.]/g, ''),
        explanation: sentence
      });

      const correctText = sentence;
      const wrongOptions = [
        "Cette affirmation est fausse d'après le document.",
        "Information non mentionnée dans le cours.",
        "Aucune de ces propositions n'est correcte."
      ];
      const allOptions = [correctText, ...wrongOptions].sort(() => Math.random() - 0.5);
      const correctIndex = allOptions.indexOf(correctText);

      generatedQuestions.push({
        id: i + 1,
        question: `Extrait du cours : quelle est l'affirmation exacte ?`,
        options: allOptions,
        correctAnswer: correctIndex,
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

export default function StudySnapApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [flashcards, setFlashcards] = useState<Flashcard[]>(DEFAULT_FLASHCARDS);
  const [fillBlanks, setFillBlanks] = useState<FillInTheBlank[]>(DEFAULT_FILLBLANKS);
  const [rawInputText, setRawInputText] = useState('');

  // États du Quiz
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // États des Flashcards
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // États des Phrases à trous
  const [fillIndex, setFillIndex] = useState(0);
  const [userBlankInput, setUserBlankInput] = useState('');
  const [fillResultState, setFillResultState] = useState<'correct' | 'incorrect' | null>(null);

  // Gestion des erreurs et du chargement
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<QuizResult[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('studysnap_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveHistory = (result: QuizResult) => {
    const updated = [result, ...history];
    setHistory(updated);
    localStorage.setItem('studysnap_history', JSON.stringify(updated));
  };

  // Timer du Quiz
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTimerActive && timeLeft > 0 && !isQuizFinished && activeTab === 'quiz') {
      timer = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    } else if (timeLeft === 0 && isTimerActive && !isQuizFinished) {
      handleNextQuestion();
    }
    return () => clearInterval(timer);
  }, [isTimerActive, timeLeft, isQuizFinished, activeTab]);

  const startQuiz = (customQ?: Question[]) => {
    if (customQ) setQuestions(customQ);
    setCurrentQuestionIndex(0);
    setScore(0);
    setIsQuizFinished(false);
    setSelectedAnswer(null);
    setTimeLeft(30);
    setIsTimerActive(true);
    setActiveTab('quiz');
  };

  const handleAnswerSelect = (idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    if (idx === questions[currentQuestionIndex]?.correctAnswer) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setTimeLeft(30);
    } else {
      setIsQuizFinished(true);
      setIsTimerActive(false);
      const total = questions.length;
      const percentage = Math.round((score / total) * 100);
      saveHistory({ date: new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }), score, total, percentage });
    }
  };

  // Traitement du texte
  const handleProcessText = (text: string) => {
    setUploadError(null);
    if (!text.trim()) {
      setUploadError("Le contenu du texte est vide.");
      return;
    }
    setIsAnalyzing(true);
    setTimeout(() => {
      const generated = generateAllExercisesFromText(text);
      setQuestions(generated.questions);
      setFlashcards(generated.flashcards);
      setFillBlanks(generated.fillBlanks);
      setIsAnalyzing(false);
      startQuiz(generated.questions);
    }, 400);
  };

  // Gestion des fichiers (PDF, TXT, JSON)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setUploadError(null);
    if (!file) return;

    setIsAnalyzing(true);

    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const extractedText = await extractTextFromPdf(file);
        if (!extractedText.trim()) {
          throw new Error("Impossible d'extraire du texte de ce fichier PDF (document scanné sous forme d'image).");
        }
        setRawInputText(extractedText);
        handleProcessText(extractedText);
      } else if (file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target?.result as string);
            if (Array.isArray(parsed)) {
              setQuestions(parsed);
              setIsAnalyzing(false);
              startQuiz(parsed);
            }
          } catch {
            setUploadError("Format JSON invalide.");
            setIsAnalyzing(false);
          }
        };
        reader.readAsText(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setRawInputText(content);
          handleProcessText(content);
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      setUploadError(err.message || "Erreur lors de la lecture du fichier.");
      setIsAnalyzing(false);
    }
  };

  // Validation phrase à trou
  const handleCheckFillBlank = () => {
    const current = fillBlanks[fillIndex];
    if (userBlankInput.trim().toLowerCase() === current.missingWord.toLowerCase()) {
      setFillResultState('correct');
      speakText("Correct ! " + current.missingWord);
    } else {
      setFillResultState('incorrect');
      speakText("Incorrect. La réponse était " + current.missingWord);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* HEADER */}
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('home')}>
          <Brain className="w-8 h-8" />
          <h1 className="text-xl font-bold tracking-wide">StudySnap <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded-full ml-1">v2.0</span></h1>
        </div>
        <nav className="flex space-x-1 md:space-x-2">
          <button onClick={() => setActiveTab('home')} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'home' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Home className="w-4 h-4" /> <span className="hidden md:inline">Accueil</span>
          </button>
          <button onClick={() => setActiveTab('quiz')} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'quiz' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Sparkles className="w-4 h-4" /> <span className="hidden md:inline">Quiz</span>
          </button>
          <button onClick={() => setActiveTab('fillblank')} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'fillblank' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Mic className="w-4 h-4" /> <span className="hidden md:inline">Trous & Vocal</span>
          </button>
          <button onClick={() => setActiveTab('flashcards')} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'flashcards' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <BookOpen className="w-4 h-4" /> <span className="hidden md:inline">Flashcards</span>
          </button>
          <button onClick={() => setActiveTab('history')} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'history' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <BarChart2 className="w-4 h-4" /> <span className="hidden md:inline">Stats</span>
          </button>
        </nav>
      </header>

      {/* CONTENU PRINCIPAL */}
      <main className="max-w-3xl mx-auto p-4 md:p-6">

        {/* 1. ACCUEIL & IMPORT */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900">Générez vos exercices de révision</h2>
                <p className="text-slate-600 text-sm mt-1">Déposez un fichier PDF/TXT ou collez votre cours pour créer vos QCM et exercices vocaux.</p>
              </div>

              {/* Import PDF / TXT */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Option 1 : Charger un document (.pdf / .txt)</label>
                <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/40 rounded-xl p-6 hover:border-indigo-400 transition cursor-pointer relative text-center">
                  <input type="file" onChange={handleFileUpload} accept=".pdf,.txt,.json" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Cliquez ou glissez un PDF / texte ici</p>
                  <p className="text-xs text-slate-400 mt-1">Extraction automatique du texte PDF intégrée</p>
                </div>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase">OU</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* Texte Brut */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Option 2 : Coller votre texte</label>
                <textarea
                  value={rawInputText}
                  onChange={(e) => setRawInputText(e.target.value)}
                  placeholder="Collez votre cours ici..."
                  rows={4}
                  className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  onClick={() => handleProcessText(rawInputText)}
                  disabled={!rawInputText.trim() || isAnalyzing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAnalyzing ? "Analyse du document..." : "Générer le Quiz"}</span>
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

        {/* 2. MODE QUIZ */}
        {activeTab === 'quiz' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            {!isQuizFinished ? (
              questions.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                      Question {currentQuestionIndex + 1} / {questions.length}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => speakText(questions[currentQuestionIndex].question)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600" title="Écouter la question">
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <div className="flex items-center space-x-1 text-slate-500 text-sm">
                        <Timer className="w-4 h-4" />
                        <span className={`font-mono font-bold ${timeLeft < 10 ? 'text-red-500' : ''}`}>{timeLeft}s</span>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-800 mb-6">{questions[currentQuestionIndex].question}</h3>

                  <div className="space-y-3 mb-6">
                    {questions[currentQuestionIndex].options.map((option, idx) => {
                      let btnStyle = "border-slate-200 hover:border-indigo-300 hover:bg-slate-50";
                      if (selectedAnswer !== null) {
                        if (idx === questions[currentQuestionIndex].correctAnswer) btnStyle = "border-green-500 bg-green-50 text-green-700 font-medium";
                        else if (idx === selectedAnswer) btnStyle = "border-red-500 bg-red-50 text-red-700";
                      }
                      return (
                        <button
                          key={idx}
                          disabled={selectedAnswer !== null}
                          onClick={() => handleAnswerSelect(idx)}
                          className={`w-full text-left p-4 border-2 rounded-xl transition flex justify-between items-center ${btnStyle}`}
                        >
                          <span>{option}</span>
                          {selectedAnswer !== null && idx === questions[currentQuestionIndex].correctAnswer && <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />}
                          {selectedAnswer !== null && idx === selectedAnswer && idx !== questions[currentQuestionIndex].correctAnswer && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {selectedAnswer !== null && (
                    <div className="p-4 bg-slate-50 rounded-xl mb-6 text-sm text-slate-600 border border-slate-100">
                      <p className="font-semibold text-slate-800 mb-1">Explication :</p>
                      {questions[currentQuestionIndex].explanation}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      disabled={selectedAnswer === null}
                      onClick={handleNextQuestion}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg flex items-center space-x-2 transition"
                    >
                      <span>{currentQuestionIndex + 1 === questions.length ? "Terminer" : "Suivant"}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center py-6 space-y-6">
                <Award className="w-16 h-16 text-indigo-600 mx-auto" />
                <h2 className="text-2xl font-bold text-slate-800">Quiz Terminé !</h2>
                <div className="bg-indigo-50 p-6 rounded-xl inline-block">
                  <p className="text-3xl font-extrabold text-indigo-600">{Math.round((score / questions.length) * 100)}%</p>
                  <p className="text-sm text-slate-600 mt-1">Score : {score} / {questions.length}</p>
                </div>
                <div className="flex justify-center space-x-4">
                  <button onClick={() => startQuiz()} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium flex items-center space-x-2 hover:bg-indigo-700 transition">
                    <RefreshCw className="w-4 h-4" /> <span>Recommencer</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. MODE PHRASES À TROUS & VOCAL */}
        {activeTab === 'fillblank' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                Exercice à trous {fillIndex + 1} / {fillBlanks.length}
              </span>
              <button onClick={() => speakText(fillBlanks[fillIndex]?.sentenceWithBlank)} className="p-2 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-indigo-600 flex items-center space-x-1 text-xs font-semibold">
                <Volume2 className="w-4 h-4" /> <span>Écouter</span>
              </button>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl text-center">
              <p className="text-lg font-medium text-slate-800 mb-4">
                {fillBlanks[fillIndex]?.sentenceWithBlank}
              </p>
              <input
                type="text"
                value={userBlankInput}
                onChange={(e) => setUserBlankInput(e.target.value)}
                disabled={fillResultState !== null}
                placeholder="Tapez le mot manquant..."
                className="w-full max-w-md p-3 text-center text-md border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {fillResultState === 'correct' && (
              <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm font-semibold flex items-center justify-between">
                <span>Bonne réponse ! 🎉</span>
              </div>
            )}
            {fillResultState === 'incorrect' && (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-semibold">
                <span>Incorrect. La réponse était : <b>{fillBlanks[fillIndex]?.missingWord}</b></span>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              {fillResultState === null ? (
                <button onClick={handleCheckFillBlank} disabled={!userBlankInput.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium transition">
                  Vérifier
                </button>
              ) : (
                <button onClick={() => {
                  setUserBlankInput('');
                  setFillResultState(null);
                  setFillIndex((prev) => (prev + 1) % fillBlanks.length);
                }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition">
                  Suivant
                </button>
              )}
            </div>
          </div>
        )}

        {/* 4. MODE FLASHCARDS */}
        {activeTab === 'flashcards' && (
          <div className="max-w-md mx-auto space-y-6">
            <div onClick={() => setIsFlipped(!isFlipped)} className="bg-white border border-slate-200 rounded-2xl p-8 h-64 flex flex-col items-center justify-center text-center cursor-pointer shadow-sm hover:shadow-md transition relative select-none">
              <span className="absolute top-4 right-4 text-xs font-semibold text-slate-400">{isFlipped ? "RÉPONSE" : "RECTO"}</span>
              <p className="text-lg font-semibold text-slate-800">{isFlipped ? flashcards[cardIndex]?.back : flashcards[cardIndex]?.front}</p>
              <p className="text-xs text-slate-400 mt-6">(Cliquer pour retourner)</p>
            </div>
            <div className="flex justify-between items-center">
              <button disabled={cardIndex === 0} onClick={() => { setIsFlipped(false); setCardIndex(p => p - 1); }} className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-100">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-slate-500 font-medium">{cardIndex + 1} / {flashcards.length}</span>
              <button disabled={cardIndex + 1 === flashcards.length} onClick={() => { setIsFlipped(false); setCardIndex(p => p + 1); }} className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-100">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* 5. HISTORIQUE & STATS */}
        {activeTab === 'history' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Historique des sessions</h2>
            {history.length === 0 ? (
              <p className="text-slate-500 text-sm">Aucun historique pour le moment.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map((item, idx) => (
                  <div key={idx} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.date}</p>
                      <p className="text-xs text-slate-500">Score : {item.score} / {item.total}</p>
                    </div>
                    <span className={`text-sm font-bold ${item.percentage >= 50 ? 'text-green-600' : 'text-red-500'}`}>{item.percentage}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
