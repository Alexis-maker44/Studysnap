import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, XCircle, AlertCircle, Timer, ChevronRight, ChevronLeft, 
  RefreshCw, Award, BookOpen, Sparkles, Upload, BarChart2, Home, Brain, Volume2, Mic 
} from 'lucide-react';

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
  { id: 1, front: "JSX", back: "Extension de syntaxe JavaScript pour React" },
  { id: 2, front: "Props", back: "Arguments transmis aux composants React" }
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

function generateAllExercisesFromText(sourceText) {
  const rawSentences = sourceText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const generatedQuestions = [];
  const generatedFlashcards = [];
  const generatedFillBlanks = [];

  rawSentences.forEach((sentence, index) => {
    const match = sentence.match(/(.+?)\s+(est|sont|désigne|représente|permet de|s'explique par)\s+(.+)/i);

    if (match) {
      const subject = match[1].replace(/^[-•*]\s*/, '').trim();
      const definition = match[3].trim();

      const correctText = definition;
      const wrongOptions = [
        `Une méthode alternative non liée à ${subject}.`,
        `Un concept obsolète dans ce domaine.`,
        `Une erreur de configuration fréquente.`
      ];

      const allOptions = [correctText, ...wrongOptions].sort(() => Math.random() - 0.5);
      const correctIndex = allOptions.indexOf(correctText);

      generatedQuestions.push({
        id: index + 1,
        question: `Que désigne le terme ou concept « ${subject} » ?`,
        options: allOptions,
        correctAnswer: correctIndex,
        explanation: sentence
      });

      generatedFlashcards.push({
        id: index + 1,
        front: subject,
        back: definition
      });

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

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [flashcards, setFlashcards] = useState(DEFAULT_FLASHCARDS);
  const [fillBlanks, setFillBlanks] = useState(DEFAULT_FILLBLANKS);
  const [rawInputText, setRawInputText] = useState('');

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isTimerActive, setIsTimerActive] = useState(false);

  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const [fillIndex, setFillIndex] = useState(0);
  const [userBlankInput, setUserBlankInput] = useState('');
  const [fillResultState, setFillResultState] = useState(null);

  const [uploadError, setUploadError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('studysnap_history');
      if (saved) setHistory(JSON.parse(saved));
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

  const handleNextQuestion = useCallback(() => {
    setCurrentQuestionIndex((prevIdx) => {
      if (prevIdx + 1 < questions.length) {
        setSelectedAnswer(null);
        setTimeLeft(30);
        return prevIdx + 1;
      } else {
        setIsQuizFinished(true);
        setIsTimerActive(false);
        const total = questions.length;
        setScore((currentScore) => {
          const percentage = Math.round((currentScore / total) * 100);
          saveHistory({ 
            date: new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }), 
            score: currentScore, 
            total, 
            percentage 
          });
          return currentScore;
        });
        return prevIdx;
      }
    });
  }, [questions.length, saveHistory]);

  useEffect(() => {
    let timer;
    if (isTimerActive && timeLeft > 0 && !isQuizFinished && activeTab === 'quiz') {
      timer = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    } else if (timeLeft === 0 && isTimerActive && !isQuizFinished) {
      handleNextQuestion();
    }
    return () => clearInterval(timer);
  }, [isTimerActive, timeLeft, isQuizFinished, activeTab, handleNextQuestion]);

  const startQuiz = (customQ) => {
    if (customQ) setQuestions(customQ);
    setCurrentQuestionIndex(0);
    setScore(0);
    setIsQuizFinished(false);
    setSelectedAnswer(null);
    setTimeLeft(30);
    setIsTimerActive(true);
    setActiveTab('quiz');
  };

  const handleAnswerSelect = (idx) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    if (idx === questions[currentQuestionIndex]?.correctAnswer) {
      setScore((prev) => prev + 1);
    }
  };

  const handleProcessText = (text) => {
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

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    setUploadError(null);
    if (!file) return;

    setIsAnalyzing(true);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (file.name.endsWith('.json')) {
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              setQuestions(parsed);
              setIsAnalyzing(false);
              startQuiz(parsed);
              return;
            }
          } catch {
            setUploadError("Format JSON invalide.");
            setIsAnalyzing(false);
            return;
          }
        }
        setRawInputText(content);
        handleProcessText(content);
      };
      reader.onerror = () => {
        setUploadError("Erreur lors de la lecture du fichier.");
        setIsAnalyzing(false);
      };
      reader.readAsText(file);
    } catch {
      setUploadError("Erreur lors du traitement du fichier.");
      setIsAnalyzing(false);
    }
  };

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

      <main className="max-w-3xl mx-auto p-4 md:p-6">
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900">Générez vos exercices de révision</h2>
                <p className="text-slate-600 text-sm mt-1">Collez votre cours ou importez un fichier texte pour générer instantanément vos exercices.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Option 1 : Charger un fichier (.txt / .json)</label>
                <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/40 rounded-xl p-6 hover:border-indigo-400 transition cursor-pointer relative text-center">
                  <input type="file" onChange={handleFileUpload} accept=".txt,.json" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Cliquez ou glissez un fichier texte ici</p>
                </div>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase">OU</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

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
                  <span>{isAnalyzing ? "Analyse en cours..." : "Générer les exercices"}</span>
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
