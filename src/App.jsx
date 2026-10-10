import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CheckCircle2, XCircle, AlertCircle, Timer, ChevronRight, ChevronLeft, 
  RefreshCw, Award, BookOpen, Sparkles, Upload, BarChart2, Home, Brain, 
  Volume2, Camera, Folder, Trash2, Plus, Zap, Heart, Play, HelpCircle, Key, Cpu
} from 'lucide-react';

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'ce', 'cette', 'ces',
  'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses', 'nos', 'vos', 'leurs',
  'qui', 'que', 'quoi', 'dont', 'où', 'quand', 'comment', 'pourquoi', 'quel', 'quelle', 'quels', 'quelles',
  'est', 'sont', 'a', 'ont', 'fait', 'fais', 'font', 'pour', 'dans', 'sur', 'avec', 'sans', 'par',
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

// --- GÉNÉRATION VIA IA EXTERNE (OPENAI / COMPATIBLE) ---
async function generateExercisesWithExternalAI(sourceText, apiKey) {
  const prompt = `
Tu es un expert pédagogique. Analyse le cours suivant et génère exactement 5 questions sous forme de JSON strict.
Contenu du cours :
"""${sourceText.slice(0, 3500)}"""

Format attendu (reponds UNIQUEMENT avec un objet JSON valide) :
{
  "questions": [
    {
      "id": 1,
      "question": "Intitulé clair et précis d'une question importante sur le cours",
      "options": ["Bonne réponse", "Mauvaise réponse 1 crédible", "Mauvaise réponse 2 crédible", "Mauvaise réponse 3 crédible"],
      "correctAnswer": 0,
      "explanation": "Explication pédagogique de la réponse."
    }
  ],
  "flashcards": [
    { "id": 1, "front": "Concept ou mot-clé", "back": "Définition ou explication claire." }
  ],
  "fillBlanks": [
    { "id": 1, "sentenceWithBlank": "La phrase avec un [___] à compléter.", "missingWord": "mot", "explanation": "Rappel de la notion." }
  ]
}
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    })
  });

  if (!response.ok) {
    throw new Error("Erreur de connexion à l'API IA (Vérifiez la clé API).");
  }

  const data = await response.json();
  const rawContent = data.choices[0].message.content.trim();
  const jsonContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(jsonContent);
}

// --- GÉNÉRATION EN MODE LOCAL (FALLBACK AUTOMATIQUE) ---
function semanticParagraphAnalysis(sourceText) {
  if (!sourceText) return [];

  const rawBlocks = sourceText
    .split(/\n\s*\n|(?<=[.!?])\s+/)
    .map((b) => b.replace(/^[-•*0-9.]+\s*/, '').trim())
    .filter((b) => b.length > 30);

  const semanticPairs = [];

  rawBlocks.forEach((block) => {
    const sentences = block.split(/(?<=[.!?])\s+/);
    if (sentences.length === 0) return;

    const mainSentence = sentences[0];
    const explanation = block;

    const words = mainSentence.replace(/[,;:!?()]/g, '').split(/\s+/);
    const keyWords = words.filter(w => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()));
    const concept = keyWords.length > 0 ? keyWords.slice(0, 3).join(' ') : mainSentence.slice(0, 25);

    if (concept.length > 3 && explanation.length > 20) {
      semanticPairs.push({
        term: concept.charAt(0).toUpperCase() + concept.slice(1),
        def: explanation.charAt(0).toUpperCase() + explanation.slice(1),
        source: block
      });
    }
  });

  return semanticPairs;
}

function generateAllExercisesLocal(sourceText) {
  const pairs = semanticParagraphAnalysis(sourceText);

  const generatedQuestions = [];
  const generatedFlashcards = [];
  const generatedFillBlanks = [];

  pairs.forEach((pair, index) => {
    generatedFlashcards.push({
      id: index + 1,
      front: pair.term,
      back: pair.def
    });

    const words = pair.term.split(' ');
    const targetWord = words[words.length - 1];
    const sentenceWithBlank = pair.source.replace(new RegExp(`\\b${targetWord}\\b`, 'gi'), '[___]');

    if (sentenceWithBlank !== pair.source) {
      generatedFillBlanks.push({
        id: index + 1,
        sentenceWithBlank,
        missingWord: targetWord,
        explanation: pair.source
      });
    }

    const correctText = pair.def;
    const otherDefs = pairs.filter(p => p.term !== pair.term).map(p => p.def);
    
    let wrongOptions = [];
    while (wrongOptions.length < 3 && otherDefs.length > 0) {
      const randIdx = Math.floor(Math.random() * otherDefs.length);
      const selectedWrong = otherDefs.splice(randIdx, 1)[0];
      if (!wrongOptions.includes(selectedWrong) && selectedWrong !== correctText) {
        wrongOptions.push(selectedWrong);
      }
    }

    const fallbacks = [
      `Cette notion décrit un phénomène non mentionné dans cette partie du cours.`,
      `Il s'agit d'une hypothèse écartée par l'analyse du document.`,
      `Cette définition correspond à un prérequis d'un autre chapitre.`
    ];
    while (wrongOptions.length < 3) {
      const fb = fallbacks[wrongOptions.length];
      if (!wrongOptions.includes(fb)) wrongOptions.push(fb);
    }

    const allOptions = [correctText, ...wrongOptions].sort(() => Math.random() - 0.5);

    generatedQuestions.push({
      id: index + 1,
      question: `Que retenir concernant la notion de « ${pair.term} » d'après le document ?`,
      options: allOptions,
      correctAnswer: allOptions.indexOf(correctText),
      explanation: pair.source
    });
  });

  return {
    questions: generatedQuestions,
    flashcards: generatedFlashcards,
    fillBlanks: generatedFillBlanks
  };
}

function buildSessionSteps(questions, flashcards, fillBlanks) {
  const steps = [];
  if (flashcards) flashcards.slice(0, 4).forEach((fc) => steps.push({ type: 'flashcard', data: fc }));

  const maxInter = Math.max(questions ? questions.length : 0, fillBlanks ? fillBlanks.length : 0);
  for (let i = 0; i < maxInter; i++) {
    if (questions && questions[i]) steps.push({ type: 'quiz', data: questions[i] });
    if (fillBlanks && fillBlanks[i]) steps.push({ type: 'fillblank', data: fillBlanks[i] });
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
  const [apiKey, setApiKey] = useState('');

  const [sessionSteps, setSessionSteps] = useState([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [isSessionFinished, setIsSessionFinished] = useState(false);

  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [userBlankInput, setUserBlankInput] = useState('');
  const [stepResultState, setStepResultState] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
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

      const savedKey = localStorage.getItem('studysnap_apikey');
      if (savedKey) setApiKey(savedKey);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSaveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('studysnap_apikey', key);
  };

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
    setTimeLeft(30);
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
      setTimeLeft(30);
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
      speakText("Incorrect. C'était " + currentStep.data.missingWord);
    }
  };

  const handleProcessText = async (text) => {
    setUploadError(null);
    if (!text || !text.trim()) {
      setUploadError("Le texte fourni est trop court ou vide.");
      return;
    }
    setIsAnalyzing(true);

    try {
      let generated;
      if (apiKey && apiKey.trim().length > 10) {
        setOcrProgress("Formulation intelligente via l'IA Externe...");
        generated = await generateExercisesWithExternalAI(text, apiKey);
      } else {
        setOcrProgress("Analyse locale sémantique...");
        generated = generateAllExercisesLocal(text);
      }

      setQuestions(generated.questions || []);
      setFlashcards(generated.flashcards || []);
      setFillBlanks(generated.fillBlanks || []);

      saveDeckToStorage(
        text.slice(0, 25) + '...',
        selectedSubject,
        generated.questions || [],
        generated.flashcards || [],
        generated.fillBlanks || []
      );

      setIsAnalyzing(false);
      setOcrProgress('');
      startSession(generated.questions, generated.flashcards, generated.fillBlanks);
    } catch (e) {
      console.error(e);
      setUploadError(e.message || "Erreur de génération avec l'IA. Bascule locale recommandée.");
      setIsAnalyzing(false);
      setOcrProgress('');
    }
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
      await handleProcessText(text);
    } catch (err) {
      setUploadError(err.message || "Erreur lors de la lecture.");
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

        if (!fullText.trim()) throw new Error("Le PDF ne contient pas de texte extractible.");

        setRawInputText(fullText);
        setOcrProgress('');
        await handleProcessText(fullText);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => processImageOCR(e.target.result);
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = async (e) => {
          setRawInputText(e.target?.result);
          await handleProcessText(e.target?.result);
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
          <h1 className="text-xl font-bold tracking-wide">StudySnap <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded-full ml-1">v3.4 (IA Direct)</span></h1>
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
                <h2 className="text-2xl font-bold text-slate-900">IA & Génération Pédagogique</h2>
                <p className="text-slate-600 text-sm mt-1">L'IA analyse le document pour formaliser des exercices riches et réalistes.</p>
              </div>

              {/* Champ Clé API OpenAI / Gemini */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 space-y-2">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Génération IA Externe (Optionnelle)</span>
                </div>
                <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
                  <Key className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                    placeholder="Clé API OpenAI (ex: sk-...)"
                    className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 placeholder-slate-400"
                  />
                </div>
                <p className="text-[11px] text-slate-500 italic">Si aucune clé n'est saisie, l'application utilise automatiquement le moteur local sémantique.</p>
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
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">2. Scanner le document (PDF / Photo / Image)</label>
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
                  <span>{isAnalyzing ? (ocrProgress || "Génération des exercices...") : "Générer avec l'IA & Lancer le Parcours"}</span>
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

                {/* QCM IA */}
                {currentStep.type === 'quiz' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">Question QCM IA</span>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => speakText(currentStep.data.question)} className="p-1.5 text-slate-500 hover:text-indigo-600">
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center space-x-1 text-slate-500 text-xs font-mono font-bold">
                          <Timer className="w-3.5 h-3.5" />
                          <span className={timeLeft < 10 ? 'text-red-500' : ''}>{timeLeft}s</span>
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
                            {stepResultState !== null && idx === currentStep.data.correctAnswer && <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />}
                            {stepResultState !== null && idx === selectedAnswer && idx !== currentStep.data.correctAnswer && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
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
                        <button onClick={advanceToNextStep} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl font-medium transition flex items-center space-x-1">
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
                  {lives > 0 ? "Session réussie !" : "Plus de vies !"}
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
                <p className="text-slate-500 text-sm">Aucun deck sauvegardé.</p>
              ) : (
                <div className="space-y-3">
                  {savedDecks.map((deck) => (
                    <div key={deck.id} className="p-4 border border-slate-200 rounded-xl flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition">
                      <div>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">{deck.subject}</span>
                        <h4 className="text-sm font-semibold text-slate-800 mt-1">{deck.title}</h4>
                        <p className="text-xs text-slate-400">Créé le {deck.date} • {deck.questions ? deck.questions.length : 0} étapes</p>
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
