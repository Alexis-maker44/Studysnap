import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CheckCircle2, XCircle, AlertCircle, Timer, ChevronRight, ChevronLeft, 
  RefreshCw, Award, BookOpen, Sparkles, Upload, Home, Brain, 
  Volume2, Camera, Folder, Trash2, Plus, Zap, Heart, Play, HelpCircle, Key, Cpu, Save, RotateCw, Wand2, Settings, Search
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

// --- NETTOYAGE ET RECONSTITUTION DES PHRASES MULTI-LIGNES (COMPATIBLE MOBILE) ---
function cleanAndStructureRawText(rawText) {
  if (!rawText) return '';

  let text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/\b4H-Chap\.\d+:?\s*[^\n]*/gi, '')
    .replace(/\b\d+\/5\b/g, '');

  const lines = text.split('\n');
  let cleanedLines = [];
  let currentParagraph = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) {
      if (currentParagraph) {
        cleanedLines.push(currentParagraph);
        currentParagraph = '';
      }
      continue;
    }

    if (!currentParagraph) {
      currentParagraph = line;
    } else {
      const lastChar = currentParagraph.slice(-1);
      if (['.', '!', '?', ':', ';'].includes(lastChar) || /^[•\-\*]/.test(line)) {
        cleanedLines.push(currentParagraph);
        currentParagraph = line;
      } else {
        currentParagraph += ' ' + line;
      }
    }
  }
  if (currentParagraph) {
    cleanedLines.push(currentParagraph);
  }

  return cleanedLines.join('\n\n');
}

// --- EXTRACTION ROBUSTE DES DÉFINITIONS (AVEC SECOURS MOBILE) ---
function extractAllDefinitionsFromText(sourceText) {
  const cleanedText = cleanAndStructureRawText(sourceText);
  const paragraphs = cleanedText.split(/\n+/);
  const definitions = [];

  paragraphs.forEach((para) => {
    const trimmed = para.trim();
    if (trimmed.length < 15) return;

    const match = trimmed.match(/^([A-ZÀ-ÖØ-ßa-zà-öø-ÿ\s,-]{2,50})\s*[:–—]\s*(.{15,})$/);
    if (match) {
      let term = match[1].trim();
      let def = match[2].trim();

      if (!/[.!?]$/.test(def)) {
        def += '.';
      }

      term = term.charAt(0).toUpperCase() + term.slice(1);
      def = def.charAt(0).toUpperCase() + def.slice(1);

      if (!definitions.some(d => d.term.toLowerCase() === term.toLowerCase())) {
        definitions.push({ term, def, source: `${term} : ${def}` });
      }
    }
  });

  // Sécurité mobile : si aucun format avec deux-points n'est trouvé, découpage intelligent par phrases
  if (definitions.length === 0) {
    const sentences = cleanedText.match(/[^.!?]+[.!?]+/g) || [];
    sentences.forEach((sentence, idx) => {
      const cleanS = sentence.trim();
      if (cleanS.length > 20) {
        const words = cleanS.split(' ');
        const term = words.slice(0, 3).join(' ') + '...';
        definitions.push({
          term: `Concept ${idx + 1}`,
          def: cleanS,
          source: cleanS
        });
      }
    });
  }

  return definitions;
}

// --- GENERATION PAR IA ---
async function generateExercisesWithExternalAI(sourceText, apiKey) {
  const cleanKey = apiKey.trim();
  const isGeminiKey = cleanKey.startsWith('AIza') || !cleanKey.startsWith('sk-');
  const structuredText = cleanAndStructureRawText(sourceText);

  const promptText = `
Tu es un professeur d'histoire-géo et expert pédagogique. Analyse le cours suivant et génère un jeu de révision au format JSON STRICT.
RÈGLE ABSOLUE : Ne coupe jamais les phrases au milieu. Les définitions doivent être ENTIÈRES et COMPLÈTES jusqu'au point final.

CONSIGNES DE FORMATAGE :
1. "questions" : Crée 5 QCM de niveau collège :
   - 'question' : Commence par un mot interrogatif ("Qui", "Que", "Quoi", "Comment", "Pourquoi") et finit par "?".
   - 'options' : 4 réponses complètes (1 bonne définition intégrale + 3 fausses). Chaque option commence par une majuscule et finit par ".".
   - 'correctAnswer' : l'index (0, 1, 2 ou 3).
   - 'explanation' : Une explication complète finissant par ".".
2. "flashcards" : Crée 5 cartes mémoires :
   - 'front' : LA DÉFINITION COMPLÈTE ET ENTIÈRE (finissant par un point ".").
   - 'back' : LE MOT-CLÉ / CONCEPT À DEVINER.
3. "fillBlanks" : 3 à 5 phrases à trous portant sur des termes clés.

TEXTE DU COURS :
"""${structuredText.slice(0, 6000)}"""

Réponds STRICTEMENT avec un objet JSON structuré comme suit (AUCUN texte d'introduction, AUCUNE balise markdown extra) :
{
  "questions": [
    {
      "id": 1,
      "question": "Que sont... ?",
      "options": ["Proposition 1.", "Proposition 2.", "Proposition 3.", "Proposition 4."],
      "correctAnswer": 0,
      "explanation": "Explication complète."
    }
  ],
  "flashcards": [
    { "id": 1, "front": "Ensemble d'idées nouvelles, formulées par des philosophes et des savants, qui circulent en Europe au XVIIIe siècle.", "back": "Les Lumières" }
  ],
  "fillBlanks": [
    { "id": 1, "sentenceWithBlank": "La [___] permet de contrôler la publication.", "missingWord": "Censure", "explanation": "Définition de la censure." }
  ]
}
`;

  let rawContent = '';

  if (isGeminiKey) {
    const modelsToTry = ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-1.5-flash-latest'];
    let response = null;

    for (const modelName of modelsToTry) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${cleanKey}`;
      try {
        response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        if (response.ok) break;
      } catch (e) {
        // Modèle suivant
      }
    }

    if (!response || !response.ok) {
      throw new Error("Erreur avec la clé Gemini. Bascule sur le moteur local.");
    }

    const data = await response.json();
    rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.5
      })
    });

    if (!response.ok) {
      throw new Error("Erreur de connexion à l'API OpenAI.");
    }

    const data = await response.json();
    rawContent = data.choices[0].message.content;
  }

  const jsonContent = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(jsonContent);
}

// --- MOTEUR LOCAL AVEC TIRAGE ALÉATOIRE ---
function generateAllExercisesLocal(sourceText) {
  const allDefs = extractAllDefinitionsFromText(sourceText);
  const shuffledDefs = [...allDefs].sort(() => Math.random() - 0.5);

  const generatedQuestions = [];
  const generatedFlashcards = [];
  const generatedFillBlanks = [];

  shuffledDefs.forEach((pair, index) => {
    generatedFlashcards.push({
      id: index + 1,
      front: pair.def,
      back: pair.term
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
    const otherDefs = shuffledDefs.filter(p => p.term !== pair.term).map(p => p.def);
    
    let wrongOptions = [];
    while (wrongOptions.length < 3 && otherDefs.length > 0) {
      const randIdx = Math.floor(Math.random() * otherDefs.length);
      const selectedWrong = otherDefs.splice(randIdx, 1)[0];
      if (!wrongOptions.includes(selectedWrong) && selectedWrong !== correctText) {
        wrongOptions.push(selectedWrong);
      }
    }

    const fallbacks = [
      `Une notion non vérifiée dans le contexte de la leçon.`,
      `Une hypothèse contredite par l'analyse du document.`,
      `Un principe appartenant à une autre période historique.`
    ];
    while (wrongOptions.length < 3) {
      const fb = fallbacks[wrongOptions.length];
      if (!wrongOptions.includes(fb)) wrongOptions.push(fb);
    }

    const allOptions = [correctText, ...wrongOptions].sort(() => Math.random() - 0.5);

    let qText = `Que désigne « ${pair.term} » ?`;
    const lowerTerm = pair.term.toLowerCase();
    if (lowerTerm.startsWith('les ') || lowerTerm.startsWith('des ')) {
      qText = `Que sont ${lowerTerm} ?`;
    } else if (lowerTerm.startsWith('le ') || lowerTerm.startsWith('la ') || lowerTerm.startsWith('un ') || lowerTerm.startsWith('une ')) {
      qText = `Qu'est-ce que ${lowerTerm} ?`;
    }

    generatedQuestions.push({
      id: index + 1,
      question: qText,
      options: allOptions,
      correctAnswer: allOptions.indexOf(correctText),
      explanation: pair.source
    });
  });

  const defaultQ = [{
    id: 1,
    question: "Quelle est la règle d'or d'une révision efficace ?",
    options: ["Se tester régulièrement avec des exercices.", "Relire passivement son cours.", "Apprendre par cœur sans comprendre.", "Ne pas corriger ses erreurs."],
    correctAnswer: 0,
    explanation: "La révision active stimule la mémoire à long terme."
  }];

  const defaultFc = [{ id: 1, front: "Ensemble d'idées nouvelles, formulées par des philosophes et des savants, qui circulent en Europe au XVIIIe siècle.", back: "Les Lumières" }];
  const defaultFb = [{ id: 1, sentenceWithBlank: "L'apprentissage [___] est le plus efficace.", missingWord: "actif", explanation: "Implique de chercher les réponses." }];

  return {
    questions: generatedQuestions.length > 0 ? generatedQuestions : defaultQ,
    flashcards: generatedFlashcards.length > 0 ? generatedFlashcards : defaultFc,
    fillBlanks: generatedFillBlanks.length > 0 ? generatedFillBlanks : defaultFb
  };
}

function buildSessionSteps(questions, flashcards, fillBlanks) {
  const steps = [];
  const shuffledFc = [...(flashcards || [])].sort(() => Math.random() - 0.5).slice(0, 5);
  const shuffledQ = [...(questions || [])].sort(() => Math.random() - 0.5).slice(0, 5);
  const shuffledFb = [...(fillBlanks || [])].sort(() => Math.random() - 0.5).slice(0, 3);

  shuffledFc.forEach((fc) => steps.push({ type: 'flashcard', data: fc }));

  const maxInter = Math.max(shuffledQ.length, shuffledFb.length);
  for (let i = 0; i < maxInter; i++) {
    if (shuffledQ[i]) steps.push({ type: 'quiz', data: shuffledQ[i] });
    if (shuffledFb[i]) steps.push({ type: 'fillblank', data: shuffledFb[i] });
  }
  return steps;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  
  const [subjectList, setSubjectList] = useState(['Histoire-Géo', 'Français', 'Mathématiques', 'Sciences']);
  const [selectedSubject, setSelectedSubject] = useState('Histoire-Géo');
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [savedDecks, setSavedDecks] = useState([]);

  const [deckSearchQuery, setDeckSearchQuery] = useState('');
  const [deckFilterSubject, setDeckFilterSubject] = useState('Tous');

  const [questions, setQuestions] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [fillBlanks, setFillBlanks] = useState([]);
  const [rawInputText, setRawInputText] = useState('');
  
  const [apiKey, setApiKey] = useState('');
  const [isKeySavedSuccess, setIsKeySavedSuccess] = useState(false);

  const [sessionSteps, setSessionSteps] = useState([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [isSessionFinished, setIsSessionFinished] = useState(false);

  const [isCardFlipped, setIsCardFlipped] = useState(false);

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
    localStorage.setItem('studysnap_apikey', key.trim());
    setIsKeySavedSuccess(true);
    setTimeout(() => setIsKeySavedSuccess(false), 3000);
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
    setIsCardFlipped(false);
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
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce deck de cours ?")) {
      const updated = savedDecks.filter((d) => d.id !== id);
      setSavedDecks(updated);
      localStorage.setItem('studysnap_decks', JSON.stringify(updated));
    }
  };

  const advanceToNextStep = useCallback(() => {
    if (currentStepIdx + 1 < sessionSteps.length && lives > 0) {
      setCurrentStepIdx((prev) => prev + 1);
      setIsCardFlipped(false);
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

  const handleProcessText = async (textToProcess) => {
    setUploadError(null);
    const cleanedText = cleanAndStructureRawText(textToProcess);
    
    if (!cleanedText || cleanedText.length < 20) {
      setUploadError("Le texte du cours est trop court ou vide.");
      return;
    }
    setIsAnalyzing(true);

    try {
      let generated;
      if (apiKey && apiKey.trim().length > 5) {
        setOcrProgress("Génération variée des exercices par l'IA...");
        try {
          generated = await generateExercisesWithExternalAI(cleanedText, apiKey);
        } catch (apiErr) {
          console.warn("IA indisponible, passage sur le moteur local :", apiErr);
          setOcrProgress("Moteur local : extraction des définitions...");
          generated = generateAllExercisesLocal(cleanedText);
        }
      } else {
        setOcrProgress("Moteur local : extraction complète des définitions...");
        generated = generateAllExercisesLocal(cleanedText);
      }

      setQuestions(generated.questions || []);
      setFlashcards(generated.flashcards || []);
      setFillBlanks(generated.fillBlanks || []);

      saveDeckToStorage(
        cleanedText.slice(0, 30) + '...',
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
      setUploadError("Une erreur est survenue lors de l'analyse.");
      setIsAnalyzing(false);
      setOcrProgress('');
    }
  };

  const handleCleanTextButton = () => {
    const cleaned = cleanAndStructureRawText(rawInputText);
    setRawInputText(cleaned);
  };

  const handleClearText = () => {
    setRawInputText('');
    setUploadError(null);
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

      const cleaned = cleanAndStructureRawText(text);
      setRawInputText(cleaned);
      setOcrProgress('');
      setIsAnalyzing(false);
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
        setOcrProgress("Extraction et nettoyage du PDF...");
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
          
          const items = tokenized.items.sort((a, b) => {
            const yA = a.transform[5];
            const yB = b.transform[5];
            if (Math.abs(yA - yB) > 5) {
              return yB - yA;
            }
            return a.transform[4] - b.transform[4];
          });

          let lastY = null;
          let pageText = '';
          items.forEach((item) => {
            const y = item.transform[5];
            if (item.str.toLowerCase().includes('http') || item.str.toLowerCase().includes('www')) return;

            if (lastY !== null && Math.abs(y - lastY) > 6) {
              pageText += '\n';
            } else if (pageText.length > 0 && !pageText.endsWith(' ')) {
              pageText += ' ';
            }
            pageText += item.str;
            lastY = y;
          });
          fullText += pageText + '\n\n';
        }

        const cleanedText = cleanAndStructureRawText(fullText);

        if (!cleanedText.trim()) throw new Error("Le PDF ne contient pas de texte extractible.");

        setRawInputText(cleanedText);
        setOcrProgress('');
        setIsAnalyzing(false);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => processImageOCR(e.target.result);
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const cleaned = cleanAndStructureRawText(e.target?.result);
          setRawInputText(cleaned);
          setIsAnalyzing(false);
        };
        reader.readAsText(file);
      }
    } catch (err) {
      setUploadError(err.message || "Erreur lors du traitement.");
      setIsAnalyzing(false);
      setOcrProgress('');
    }
  };

  const filteredDecks = savedDecks.filter((deck) => {
    const matchesSearch = deck.title.toLowerCase().includes(deckSearchQuery.toLowerCase());
    const matchesSubject = deckFilterSubject === 'Tous' || deck.subject === deckFilterSubject;
    return matchesSearch && matchesSubject;
  });

  const currentStep = sessionSteps[currentStepIdx];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('home')}>
          <Brain className="w-8 h-8 text-amber-300" />
          <h1 className="text-xl font-bold tracking-wide">StudySnap <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded-full ml-1">v5.5</span></h1>
        </div>
        <nav className="flex space-x-1 md:space-x-2">
          <button onClick={() => setActiveTab('home')} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'home' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Home className="w-4 h-4" /> <span className="hidden md:inline">Accueil</span>
          </button>
          <button onClick={() => startSession()} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'session' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Play className="w-4 h-4" /> <span className="hidden md:inline">Révision Active</span>
          </button>
          <button onClick={() => setActiveTab('decks')} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'decks' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Folder className="w-4 h-4" /> <span className="hidden md:inline">Mes Decks</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`px-3 py-1.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition ${activeTab === 'settings' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}>
            <Settings className="w-4 h-4" /> <span className="hidden md:inline">Paramètres</span>
          </button>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-6">
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900">Générateur Pédagogique Mobile & PC</h2>
                <p className="text-slate-600 text-sm mt-1">Importez votre cours, vérifiez le texte, puis lancez la génération à votre rythme.</p>
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
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">2. Importer le cours (PDF ou Photo)</label>
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
                      <span className="text-sm font-semibold text-slate-700">Importer le PDF du cours</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">3. Coller le texte du cours (optionnel)</label>
                <textarea
                  rows="6"
                  value={rawInputText}
                  onChange={(e) => setRawInputText(e.target.value)}
                  placeholder="Ou collez directement le contenu brut de votre leçon ici..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                ></textarea>
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <div className="flex space-x-2">
                    <button onClick={handleCleanTextButton} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1">
                      <Wand2 className="w-3.5 h-3.5" /> <span>Nettoyer le texte</span>
                    </button>
                    <button onClick={handleClearText} className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center space-x-1">
                      <Trash2 className="w-3.5 h-3.5" /> <span>Effacer</span>
                    </button>
                  </div>
                  <button
                    onClick={() => handleProcessText(rawInputText)}
                    disabled={isAnalyzing || !rawInputText.trim()}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 transition shadow-sm"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{ocrProgress || "Analyse en cours..."}</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Générer les exercices & Réviser</span>
                      </>
                    )}
                  </button>
                </div>
                {uploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>
            </div>

            {history.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <span>Historique des sessions</span>
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {history.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-sm">
                      <div>
                        <span className="font-semibold text-slate-800">{item.subject}</span>
                        <span className="text-xs text-slate-500 ml-2">{item.date}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 font-semibold rounded-lg">{item.score} pts</span>
                        <span className={`text-xs font-bold ${item.percentage >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{item.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'session' && (
          <div className="space-y-4">
            {!isSessionFinished && currentStep ? (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg">
                      Étape {currentStepIdx + 1} / {sessionSteps.length}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">Combo : x{combo}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1 text-rose-500 font-bold text-sm">
                      <Heart className="w-4 h-4 fill-current" />
                      <span>{lives}</span>
                    </div>
                    {currentStep.type !== 'flashcard' && (
                      <div className={`flex items-center space-x-1 text-sm font-bold ${timeLeft <= 5 ? 'text-rose-600 animate-pulse' : 'text-slate-600'}`}>
                        <Timer className="w-4 h-4" />
                        <span>{timeLeft}s</span>
                      </div>
                    )}
                  </div>
                </div>

                {currentStep.type === 'flashcard' && (
                  <div className="space-y-4">
                    <div
                      onClick={() => setIsCardFlipped(!isCardFlipped)}
                      className="w-full min-h-[220px] p-6 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl shadow-md flex flex-col justify-between cursor-pointer transition transform hover:scale-[1.01]"
                    >
                      <div className="flex justify-between items-center text-indigo-200 text-xs font-semibold">
                        <span>CARTE MÉMOIRE</span>
                        <button onClick={(e) => { e.stopPropagation(); speakText(isCardFlipped ? currentStep.data.back : currentStep.data.front); }} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg">
                          <Volume2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                      <div className="text-center my-auto py-4">
                        <p className="text-lg md:text-xl font-medium">
                          {isCardFlipped ? currentStep.data.back : currentStep.data.front}
                        </p>
                      </div>
                      <div className="text-center text-xs text-indigo-200">
                        {isCardFlipped ? "Cliquez pour voir la définition" : "Cliquez pour révéler le concept"}
                      </div>
                    </div>
                    <button
                      onClick={advanceToNextStep}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition shadow-sm"
                    >
                      Carte suivante <ChevronRight className="w-4 h-4 inline ml-1" />
                    </button>
                  </div>
                )}

                {currentStep.type === 'quiz' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-bold text-slate-900">{currentStep.data.question}</h3>
                      <button onClick={() => speakText(currentStep.data.question)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600">
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {currentStep.data.options.map((opt, idx) => {
                        let btnStyle = "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800";
                        if (selectedAnswer !== null) {
                          if (idx === currentStep.data.correctAnswer) {
                            btnStyle = "bg-green-50 border-green-300 text-green-800 font-semibold";
                          } else if (idx === selectedAnswer) {
                            btnStyle = "bg-rose-50 border-rose-300 text-rose-800";
                          }
                        }
                        return (
                          <button
                            key={idx}
                            onClick={() => handleAnswerSelect(idx)}
                            disabled={selectedAnswer !== null}
                            className={`p-3.5 border rounded-xl text-left text-sm transition flex justify-between items-center ${btnStyle}`}
                          >
                            <span>{opt}</span>
                            {selectedAnswer !== null && idx === currentStep.data.correctAnswer && (
                              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 ml-2" />
                            )}
                            {selectedAnswer !== null && idx === selectedAnswer && idx !== currentStep.data.correctAnswer && (
                              <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {stepResultState !== null && (
                      <div className="space-y-3 pt-2">
                        <div className={`p-4 rounded-xl text-sm ${stepResultState === 'correct' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                          <p className="font-semibold">{stepResultState === 'correct' ? "Bonne réponse !" : "Mauvaise réponse."}</p>
                          <p className="mt-1 text-xs">{currentStep.data.explanation}</p>
                        </div>
                        <button
                          onClick={advanceToNextStep}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition shadow-sm flex items-center justify-center space-x-1"
                        >
                          <span>Continuer</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {currentStep.type === 'fillblank' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Complétez la phrase</h3>
                    <p className="text-lg font-medium text-slate-900 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      {currentStep.data.sentenceWithBlank}
                    </p>

                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={userBlankInput}
                        onChange={(e) => setUserBlankInput(e.target.value)}
                        disabled={stepResultState !== null}
                        placeholder="Votre réponse..."
                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleCheckFillBlank()}
                      />
                      <button
                        onClick={handleCheckFillBlank}
                        disabled={stepResultState !== null || !userBlankInput.trim()}
                        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-semibold text-sm transition"
                      >
                        Valider
                      </button>
                    </div>

                    {stepResultState !== null && (
                      <div className="space-y-3 pt-2">
                        <div className={`p-4 rounded-xl text-sm ${stepResultState === 'correct' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                          <p className="font-semibold">{stepResultState === 'correct' ? "Excellente réponse !" : `Incorrect. Le mot attendu était : ${currentStep.data.missingWord}`}</p>
                          <p className="mt-1 text-xs">{currentStep.data.explanation}</p>
                        </div>
                        <button
                          onClick={advanceToNextStep}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition shadow-sm flex items-center justify-center space-x-1"
                        >
                          <span>Continuer</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center space-y-6">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <Award className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-slate-900">Session Terminée !</h3>
                  <p className="text-slate-600 text-sm">Vous avez complété tous les exercices de cette session.</p>
                </div>
                <div className="inline-block bg-indigo-50 border border-indigo-100 px-6 py-4 rounded-2xl">
                  <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block">Score Final</span>
                  <span className="text-3xl font-extrabold text-indigo-700">{score} pts</span>
                </div>
                <div className="flex justify-center space-x-3 pt-2">
                  <button onClick={() => startSession()} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition">
                    Recommencer
                  </button>
                  <button onClick={() => setActiveTab('decks')} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition">
                    Voir mes Decks
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'decks' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Mes Decks de Cours Enregistrés</h3>
              
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={deckSearchQuery}
                    onChange={(e) => setDeckSearchQuery(e.target.value)}
                    placeholder="Rechercher un deck..."
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <select
                  value={deckFilterSubject}
                  onChange={(e) => setDeckFilterSubject(e.target.value)}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Tous">Toutes les matières</option>
                  {subjectList.map((subj, idx) => (
                    <option key={idx} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>

              {filteredDecks.length > 0 ? (
                <div className="space-y-3">
                  {filteredDecks.map((deck) => (
                    <div key={deck.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center transition hover:border-indigo-300">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">{deck.subject}</span>
                          <span className="text-xs text-slate-500">{deck.date}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm">{deck.title}</h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleLoadDeck(deck)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1">
                          <Play className="w-3.5 h-3.5" /> <span>Réviser</span>
                        </button>
                        <button onClick={() => handleDeleteDeck(deck.id)} className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm text-center py-8">Aucun deck trouvé.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Paramètres & Clé API IA</h3>
              <p className="text-slate-600 text-sm">Configurez votre clé API Gemini ou OpenAI pour une génération IA avancée, ou laissez vide pour utiliser le moteur local par défaut.</p>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Clé API (Gemini / OpenAI)</label>
                <div className="flex space-x-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy... ou sk-..."
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <button onClick={() => handleSaveApiKey(apiKey)} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center space-x-1">
                    <Save className="w-4 h-4" /> <span>Enregistrer</span>
                  </button>
                </div>
                {isKeySavedSuccess && (
                  <p className="text-xs text-green-600 font-semibold">Clé API enregistrée avec succès !</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
