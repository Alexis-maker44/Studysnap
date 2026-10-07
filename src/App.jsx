import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, XCircle, AlertCircle, Timer, ChevronRight, ChevronLeft, 
  RefreshCw, Award, BookOpen, Sparkles, Upload, FileText, Check, X, 
  Shuffle, BarChart2, Home, Plus, Brain, Volume2, VolumeX, Eye, Settings 
} from 'lucide-react';

// --- TYPES ---
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

interface QuizResult {
  date: string;
  score: number;
  total: number;
  percentage: number;
}

// --- INITIAL DATA ---
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

export default function StudySnapApp() {
  // --- STATES ---
  const [activeTab, setActiveTab] = useState<'home' | 'quiz' | 'flashcards' | 'history'>('home');
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [flashcards, setFlashcards] = useState<Flashcard[]>(DEFAULT_FLASHCARDS);
  
  // Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Flashcards State
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Upload & App State
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [history, setHistory] = useState<QuizResult[]>([]);

  // --- LOCALSTORAGE PERSISTENCE ---
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('studysnap_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (e) {
      console.error("Erreur de chargement depuis LocalStorage:", e);
    }
  }, []);

  const saveHistory = (newResult: QuizResult) => {
    const updatedHistory = [newResult, ...history];
    setHistory(updatedHistory);
    try {
      localStorage.setItem('studysnap_history', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error("Erreur de sauvegarde dans LocalStorage:", e);
    }
  };

  // --- TIMER LOGIC ---
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTimerActive && timeLeft > 0 && !isQuizFinished && activeTab === 'quiz') {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerActive && !isQuizFinished) {
      handleNextQuestion();
    }
    return () => clearInterval(timer);
  }, [isTimerActive, timeLeft, isQuizFinished, activeTab]);

  // --- HANDLERS ---
  const startQuiz = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setIsQuizFinished(false);
    setSelectedAnswer(null);
    setTimeLeft(30);
    setIsTimerActive(true);
    setActiveTab('quiz');
  };

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    if (index === questions[currentQuestionIndex]?.correctAnswer) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setTimeLeft(30);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    setIsQuizFinished(true);
    setIsTimerActive(false);
    
    // Safety check against division by zero
    const total = questions.length;
    const calcPercentage = total > 0 ? Math.round((score / total) * 100) : 0;

    saveHistory({
      date: new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      score,
      total,
      percentage: calcPercentage
    });
  };

  // File Upload Handling
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setUploadError(null);

    if (!file) return;

    if (file.type !== "text/plain" && !file.name.endsWith('.json')) {
      setUploadError("Veuillez importer un fichier texte (.txt) ou JSON valide.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) && parsed[0]?.question) {
            setQuestions(parsed);
            startQuiz();
          } else {
            throw new Error("Format JSON invalide");
          }
        } else {
          // Fallback parsing simple pour .txt
          const lines = content.split('\n').filter(l => l.trim() !== '');
          if (lines.length > 0) {
            alert("Fichier texte chargé avec succès (simulation de génération).");
          }
        }
      } catch (err) {
        setUploadError("Erreur lors de la lecture du fichier. Format non supporté.");
      }
    };
    reader.onerror = () => setUploadError("Une erreur est survenue lors du chargement du fichier.");
    reader.readAsText(file);
  };

  // Calculated percentage with anti-NaN protection
  const finalPercentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* HEADER */}
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('home')}>
          <Brain className="w-8 h-8" />
          <h1 className="text-xl font-bold tracking-wide">StudySnap</h1>
        </div>
        <nav className="flex space-x-2">
          <button 
            onClick={() => setActiveTab('home')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'home' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}
          >
            <Home className="w-4 h-4" /> <span>Accueil</span>
          </button>
          <button 
            onClick={() => setActiveTab('flashcards')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'flashcards' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}
          >
            <BookOpen className="w-4 h-4" /> <span>Flashcards</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'history' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}
          >
            <BarChart2 className="w-4 h-4" /> <span>Historique</span>
          </button>
        </nav>
      </header>

      {/* CONTENT AREA */}
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        
        {/* TAB 1: HOME & UPLOAD */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center space-y-4">
              <h2 className="text-2xl font-bold text-slate-900">Transformez vos cours en Quiz</h2>
              <p className="text-slate-600 max-w-lg mx-auto">
                Importez un fichier de cours pour générer instantanément des séries de questions et réviser efficacement.
              </p>
              
              <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl p-8 hover:border-indigo-400 transition cursor-pointer relative">
                <input 
                  type="file" 
                  onChange={handleFileUpload} 
                  accept=".txt,.json"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Déposez un fichier texte ou JSON ici</p>
                <p className="text-xs text-slate-500 mt-1">Formats supportés : .txt, .json</p>
              </div>

              {uploadError && (
                <div className="flex items-center justify-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="pt-4 flex justify-center space-x-4">
                <button 
                  onClick={startQuiz}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-sm transition"
                >
                  Lancer le Quiz Démo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: QUIZ */}
        {activeTab === 'quiz' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 max-w-2xl mx-auto">
            {!isQuizFinished ? (
              questions.length > 0 ? (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                      Question {currentQuestionIndex + 1} / {questions.length}
                    </span>
                    <div className="flex items-center space-x-1 text-slate-500 text-sm">
                      <Timer className="w-4 h-4" />
                      <span className={`font-mono font-bold ${timeLeft < 10 ? 'text-red-500' : ''}`}>{timeLeft}s</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-800 mb-6">
                    {questions[currentQuestionIndex].question}
                  </h3>

                  <div className="space-y-3 mb-6">
                    {questions[currentQuestionIndex].options.map((option, idx) => {
                      let btnStyle = "border-slate-200 hover:border-indigo-300 hover:bg-slate-50";
                      if (selectedAnswer !== null) {
                        if (idx === questions[currentQuestionIndex].correctAnswer) {
                          btnStyle = "border-green-500 bg-green-50 text-green-700 font-medium";
                        } else if (idx === selectedAnswer) {
                          btnStyle = "border-red-500 bg-red-50 text-red-700";
                        }
                      }

                      return (
                        <button
                          key={idx}
                          disabled={selectedAnswer !== null}
                          onClick={() => handleAnswerSelect(idx)}
                          className={`w-full text-left p-4 border-2 rounded-xl transition flex justify-between items-center ${btnStyle}`}
                        >
                          <span>{option}</span>
                          {selectedAnswer !== null && idx === questions[currentQuestionIndex].correctAnswer && (
                            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                          )}
                          {selectedAnswer !== null && idx === selectedAnswer && idx !== questions[currentQuestionIndex].correctAnswer && (
                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                          )}
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
              ) : (
                <p className="text-center text-slate-500">Aucune question disponible.</p>
              )
            ) : (
              /* RESULTS VIEW */
              <div className="text-center py-6 space-y-6">
                <Award className="w-16 h-16 text-indigo-600 mx-auto" />
                <h2 className="text-2xl font-bold text-slate-800">Quiz Terminé !</h2>
                
                <div className="bg-indigo-50 p-6 rounded-xl inline-block">
                  <p className="text-3xl font-extrabold text-indigo-600">{finalPercentage}%</p>
                  <p className="text-sm text-slate-600 mt-1">Score : {score} / {questions.length}</p>
                </div>

                <div className="flex justify-center space-x-4 pt-4">
                  <button
                    onClick={startQuiz}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium flex items-center space-x-2 hover:bg-indigo-700 transition"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Recommencer</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('home')}
                    className="border border-slate-300 text-slate-700 px-5 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition"
                  >
                    Accueil
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FLASHCARDS */}
        {activeTab === 'flashcards' && (
          <div className="max-w-md mx-auto space-y-6">
            <div 
              onClick={() => setIsFlipped(!isFlipped)}
              className="bg-white border border-slate-200 rounded-2xl p-8 h-64 flex flex-col items-center justify-center text-center cursor-pointer shadow-sm hover:shadow-md transition relative transform-gpu"
              style={{ perspective: 1000 }}
            >
              <span className="absolute top-4 right-4 text-xs font-semibold text-slate-400">
                {isFlipped ? "RÉPONSE" : "QUESTION"}
              </span>
              <p className="text-xl font-semibold text-slate-800">
                {isFlipped ? flashcards[cardIndex]?.back : flashcards[cardIndex]?.front}
              </p>
              <p className="text-xs text-slate-400 mt-6">(Cliquer pour retourner)</p>
            </div>

            <div className="flex justify-between items-center">
              <button
                disabled={cardIndex === 0}
                onClick={() => { setIsFlipped(false); setCardIndex(prev => prev - 1); }}
                className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-slate-500 font-medium">
                {cardIndex + 1} / {flashcards.length}
              </span>
              <button
                disabled={cardIndex + 1 === flashcards.length}
                onClick={() => { setIsFlipped(false); setCardIndex(prev => prev + 1); }}
                className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Historique des résultats</h2>
            {history.length === 0 ? (
              <p className="text-slate-500 text-sm">Aucun résultat enregistré pour le moment.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map((item, idx) => (
                  <div key={idx} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.date}</p>
                      <p className="text-xs text-slate-500">Score : {item.score} / {item.total}</p>
                    </div>
                    <span className={`text-sm font-bold ${item.percentage >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                      {item.percentage}%
                    </span>
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
