import React, { useState, useEffect } from 'react';
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

// --- MOTEUR DE GÉNÉRATION DE QUESTIONNAIRE ---
function generateQuizFromText(sourceText: string): { questions: Question[]; flashcards: Flashcard[] } {
  // Découpage par phrases
  const rawSentences = sourceText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const generatedQuestions: Question[] = [];
  const generatedFlashcards: Flashcard[] = [];

  rawSentences.forEach((sentence, index) => {
    // Recherche de structures de type Définition / Concept
    const match = sentence.match(/(.+?)\s+(est|sont|désigne|représente|permet de|s'explique par)\s+(.+)/i);

    if (match && generatedQuestions.length < 10) {
      const subject = match[1].replace(/^[-•*]\s*/, '').trim();
      const definition = match[3].trim();

      // Construction des propositions QCM
      const options = [
        definition,
        `Une méthode alternative non liée à ${subject}.`,
        `Un concept obsolète dans ce domaine.`,
        `Une erreur de configuration fréquente.`
      ].sort(() => Math.random() - 0.5);

      generatedQuestions.push({
        id: index + 1,
        question: `Que désigne le terme ou concept « ${subject} » ?`,
        options: options,
        correctAnswer: options.indexOf(definition),
        explanation: sentence
      });

      generatedFlashcards.push({
        id: index + 1,
        front: subject,
        back: definition
      });
    }
  });

  // Mode secours si le texte manque de mots-clés de définition
  if (generatedQuestions.length === 0 && rawSentences.length > 0) {
    rawSentences.slice(0, 5).forEach((sentence, i) => {
      const options = [
        sentence,
        "Cette affirmation est fausse d'après le cours.",
        "Énoncé non mentionné dans le document source.",
        "Aucune de ces réponses."
      ].sort(() => Math.random() - 0.5);

      generatedQuestions.push({
        id: i + 1,
        question: `Lequel de ces éléments est extrait directement du texte de cours ?`,
        options: options,
        correctAnswer: options.indexOf(sentence),
        explanation: `Extrait source : "${sentence}"`
      });

      generatedFlashcards.push({
        id: i + 1,
        front: `Point clé n°${i + 1}`,
        back: sentence
      });
    });
  }

  return { questions: generatedQuestions, flashcards: generatedFlashcards };
}

export default function StudySnapApp() {
  // --- ÉTATS PRINCIPAUX ---
  const [activeTab, setActiveTab] = useState<'home' | 'quiz' | 'flashcards' | 'history'>('home');
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [flashcards, setFlashcards] = useState<Flashcard[]>(DEFAULT_FLASHCARDS);
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

  // Historique et Gestion des erreurs
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [history, setHistory] = useState<QuizResult[]>([]);

  // --- PERSISTANCE LOCALSTORAGE ---
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('studysnap_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (e) {
      console.error("Erreur de lecture du LocalStorage", e);
    }
  }, []);

  const saveHistory = (newResult: QuizResult) => {
    const updated = [newResult, ...history];
    setHistory(updated);
    try {
      localStorage.setItem('studysnap_history', JSON.stringify(updated));
    } catch (e) {
      console.error("Erreur d'écriture dans le LocalStorage", e);
    }
  };

  // --- GESTION DU TIMER ---
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTimerActive && timeLeft > 0 && !isQuizFinished && activeTab === 'quiz') {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && isTimerActive && !isQuizFinished) {
      handleNextQuestion();
    }
    return () => clearInterval(timer);
  }, [isTimerActive, timeLeft, isQuizFinished, activeTab]);

  // --- ACTIONS QUIZ ---
  const startQuiz = (customQuestions?: Question[], customCards?: Flashcard[]) => {
    if (customQuestions && customQuestions.length > 0) {
      setQuestions(customQuestions);
    }
    if (customCards && customCards.length > 0) {
      setFlashcards(customCards);
    }

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

    const total = questions.length;
    const calcPercentage = total > 0 ? Math.round((score / total) * 100) : 0;

    saveHistory({
      date: new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      score,
      total,
      percentage: calcPercentage
    });
  };

  // --- TRAITEMENT DU TEXTE / FICHIER ---
  const handleProcessText = (text: string) => {
    setUploadError(null);
    if (!text.trim()) {
      setUploadError("Le contenu saisi ou le fichier est vide.");
      return;
    }

    const { questions: newQs, flashcards: newFc } = generateQuizFromText(text);

    if (newQs.length === 0) {
      setUploadError("Impossible de générer des questions à partir de ce texte. Fournissez des phrases plus complètes.");
      return;
    }

    startQuiz(newQs, newFc);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setUploadError(null);

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) && parsed[0]?.question) {
            startQuiz(parsed, DEFAULT_FLASHCARDS);
          } else {
            throw new Error("Format JSON non valide");
          }
        } else {
          // Traitement texte brut
          setRawInputText(content);
          handleProcessText(content);
        }
      } catch (err) {
        setUploadError("Erreur de lecture du fichier. Assurez-vous d'importer un fichier .txt ou .json valide.");
      }
    };

    reader.onerror = () => setUploadError("Erreur lors de l'accès au fichier local.");
    reader.readAsText(file);
  };

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

      {/* ZONE DE CONTENU */}
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        
        {/* TAB 1: ACCUEIL & GÉNÉRATEUR */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900">Générez votre Questionnaire</h2>
                <p className="text-slate-600 text-sm mt-1">Collez votre cours ci-dessous ou importez un fichier pour créer automatiquement votre quiz.</p>
              </div>

              {/* ZONE TEXTE BRUT */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Option A : Coller votre texte de cours</label>
                <textarea
                  value={rawInputText}
                  onChange={(e) => setRawInputText(e.target.value)}
                  placeholder="Exemple : Le hook useState permet d'ajouter un état local à un composant fonctionnel React. Le hook useEffect s'exécute après le rendu..."
                  rows={5}
                  className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  onClick={() => handleProcessText(rawInputText)}
                  disabled={!rawInputText.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Générer le Quiz depuis le texte</span>
                </button>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase">OU</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* ZONE FICHIER */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Option B : Charger un fichier (.txt / .json)</label>
                <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl p-6 hover:border-indigo-400 transition cursor-pointer relative text-center">
                  <input 
                    type="file" 
                    onChange={handleFileUpload} 
                    accept=".txt,.json"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Cliquez ou déposez un fichier texte ici</p>
                </div>
              </div>

              {uploadError && (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="pt-2 text-center">
                <button 
                  onClick={() => startQuiz()}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium underline"
                >
                  Ou essayer avec le Quiz de démonstration
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
                <p className="text-center text-slate-500">Aucune question chargée.</p>
              )
            ) : (
              /* ÉCRAN DE RÉSULTAT */
              <div className="text-center py-6 space-y-6">
                <Award className="w-16 h-16 text-indigo-600 mx-auto" />
                <h2 className="text-2xl font-bold text-slate-800">Quiz Terminé !</h2>
                
                <div className="bg-indigo-50 p-6 rounded-xl inline-block">
                  <p className="text-3xl font-extrabold text-indigo-600">{finalPercentage}%</p>
                  <p className="text-sm text-slate-600 mt-1">Score : {score} / {questions.length}</p>
                </div>

                <div className="flex justify-center space-x-4 pt-4">
                  <button
                    onClick={() => startQuiz()}
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
              className="bg-white border border-slate-200 rounded-2xl p-8 h-64 flex flex-col items-center justify-center text-center cursor-pointer shadow-sm hover:shadow-md transition relative select-none"
            >
              <span className="absolute top-4 right-4 text-xs font-semibold text-slate-400">
                {isFlipped ? "RÉPONSE" : "RECTO"}
              </span>
              <p className="text-lg font-semibold text-slate-800">
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

        {/* TAB 4: HISTORIQUE */}
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
