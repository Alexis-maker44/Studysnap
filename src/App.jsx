import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CheckCircle2, XCircle, AlertCircle, Timer, ChevronRight, ChevronLeft, 
  RefreshCw, Award, BookOpen, Sparkles, Upload, Home, Brain, 
  Volume2, Camera, Folder, Trash2, Plus, Zap, Heart, Play, HelpCircle, Key, Cpu, Save, RotateCw, Wand2, Settings
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

// --- NETTOYAGE ET RECONSTITUTION DES PHRASES MULTI-LIGNES ---
function cleanAndStructureRawText(rawText) {
  if (!rawText) return '';

  let text = rawText
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

// --- EXTRACTION EXHAUSTIVE DE TOUTES LES DÉFINITIONS ---
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
    const updated = savedDecks.filter((d) => d.id !== id);
    setSavedDecks(updated);
    localStorage.setItem('studysnap_decks', JSON.stringify(updated));
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

  const currentStep = sessionSteps[currentStepIdx];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('home')}>
          <Brain className="w-8 h-8 text-amber-300" />
          <h1 className="text-xl font-bold tracking-wide">StudySnap <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded-full ml-1">v5.2</span></h1>
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
        {/* ACCUEIL */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900">Générateur Pédagogique Manuel</h2>
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
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">3. Texte extrait & Reconstitué (Vérifiable)</label>
                  {rawInputText.trim() && (
                    <button onClick={handleCleanTextButton} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 font-semibold">
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Nettoyer les sauts de ligne</span>
                    </button>
                  )}
                </div>
                <textarea
                  value={rawInputText}
                  onChange={(e) => setRawInputText(e.target.value)}
                  placeholder="Le texte s'affichera ici après l'import. Vous pouvez le relire avant de générer le jeu..."
                  rows={5}
                  className="w-full p-3 text-xs font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  onClick={() => handleProcessText(rawInputText)}
                  disabled={!rawInputText.trim() || isAnalyzing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition flex items-center justify-center space-x-2 shadow-sm"
                >
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>{isAnalyzing ? (ocrProgress || "Génération en cours...") : "Générer les exercices & Lancer le Jeu"}</span>
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
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-semibold flex items-center space-x-0.5">
                          <Zap className="w-3 h-3" />
                          <span>Combo x{combo}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex space-x-1 text-red-500">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Heart
                            key={i}
                            className={`w-4 h-4 ${i < lives ? 'fill-current text-red-500' : 'text-slate-200'}`}
                          />
                        ))}
                      </div>
                      <div className="text-sm font-semibold text-slate-700">
                        Score: <span className="text-indigo-600">{score}</span>
                      </div>
                      {currentStep.type !== 'flashcard' && (
                        <div className={`flex items-center space-x-1 text-xs font-bold ${timeLeft <= 5 ? 'text-red-600 animate-pulse' : 'text-slate-600'}`}>
                          <Timer className="w-4 h-4" />
                          <span>{timeLeft}s</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full transition-all duration-300"
                      style={{ width: `${((currentStepIdx + 1) / sessionSteps.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Flashcard */}
                {currentStep.type === 'flashcard' && (
                  <div className="space-y-6 text-center">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span>Carte Mémoire</span>
                      <span>Recto (Définition complète) / Verso (Mot-clé)</span>
                    </div>

                    <div
                      onClick={() => setIsCardFlipped(!isCardFlipped)}
                      className={`w-full min-h-[220px] p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center relative shadow-sm ${
                        isCardFlipped ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="absolute top-4 left-4 text-xs font-medium text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        {isCardFlipped ? 'Mot-clé à trouver (Verso)' : 'Définition complète (Recto)'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakText(isCardFlipped ? currentStep.data.back : currentStep.data.front);
                        }}
                        className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
                        title="Écouter"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>

                      <div className="my-6 max-w-md">
                        <h3 className={`transition-all ${isCardFlipped ? 'text-2xl text-indigo-900 font-bold' : 'text-base text-slate-800 font-medium leading-relaxed'}`}>
                          {isCardFlipped ? currentStep.data.back : currentStep.data.front}
                        </h3>
                      </div>

                      <p className="text-xs text-slate-400 italic">Cliquez sur la carte pour révéler la réponse</p>
                    </div>

                    <button
                      onClick={advanceToNextStep}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition shadow-sm flex items-center justify-center space-x-2"
                    >
                      <span>Carte suivante</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Quiz QCM */}
                {currentStep.type === 'quiz' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span>Question du Cours</span>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900">{currentStep.data.question}</h3>
                    </div>

                    <div className="space-y-3">
                      {currentStep.data.options.map((option, idx) => {
                        let btnStyle = "bg-white border-slate-200 text-slate-800 hover:border-indigo-400";
                        if (selectedAnswer !== null) {
                          if (idx === currentStep.data.correctAnswer) {
                            btnStyle = "bg-green-50 border-green-500 text-green-900 font-semibold";
                          } else if (idx === selectedAnswer) {
                            btnStyle = "bg-red-50 border-red-500 text-red-900";
                          } else {
                            btnStyle = "opacity-50 bg-white border-slate-200 text-slate-500";
                          }
                        }

                        return (
                          <button
                            key={idx}
                            onClick={() => handleAnswerSelect(idx)}
                            disabled={selectedAnswer !== null}
                            className={`w-full p-4 rounded-xl border-2 text-left transition flex justify-between items-center ${btnStyle}`}
                          >
                            <span className="text-sm leading-relaxed">{option}</span>
                            {selectedAnswer !== null && idx === currentStep.data.correctAnswer && (
                              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                            )}
                            {selectedAnswer !== null && idx === selectedAnswer && idx !== currentStep.data.correctAnswer && (
                              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {stepResultState !== null && (
                      <div className="space-y-4 pt-2 animate-fade-in">
                        <div className={`p-4 rounded-xl border text-sm ${stepResultState === 'correct' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                          <p className="font-semibold mb-1">{stepResultState === 'correct' ? '✨ Bonne réponse !' : '❌ Pas tout à fait.'}</p>
                          <p className="text-xs text-slate-600 mt-1">{currentStep.data.explanation}</p>
                        </div>
                        <button
                          onClick={advanceToNextStep}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition flex items-center justify-center space-x-2 shadow-sm"
                        >
                          <span>Étape suivante</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Texte à trous */}
                {currentStep.type === 'fillblank' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span>Texte à Trous</span>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                      <h3 className="text-lg font-medium text-slate-900 leading-relaxed">
                        {currentStep.data.sentenceWithBlank}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="text"
                        value={userBlankInput}
                        onChange={(e) => setUserBlankInput(e.target.value)}
                        disabled={stepResultState !== null}
                        placeholder="Écrivez le mot manquant..."
                        className="w-full p-4 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && stepResultState === null) {
                            handleCheckFillBlank();
                          }
                        }}
                      />
                      {stepResultState === null ? (
                        <button
                          onClick={handleCheckFillBlank}
                          disabled={!userBlankInput.trim()}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition shadow-sm"
                        >
                          Vérifier
                        </button>
                      ) : (
                        <div className="space-y-4 animate-fade-in">
                          <div className={`p-4 rounded-xl border text-sm ${stepResultState === 'correct' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                            <p className="font-semibold mb-1">
                              {stepResultState === 'correct' ? '✨ C\'est exact !' : `❌ Le mot attendu était : "${currentStep.data.missingWord}"`}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">{currentStep.data.explanation}</p>
                          </div>
                          <button
                            onClick={advanceToNextStep}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition flex items-center justify-center space-x-2 shadow-sm"
                          >
                            <span>Étape suivante</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center space-y-6 py-8">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
                  <Award className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-slate-900">Session Terminée ! 🎉</h2>
                  <p className="text-sm text-slate-600">Bravo pour tes efforts de révision !</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 max-w-sm mx-auto space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Score final :</span>
                    <span className="font-bold text-indigo-600">{score} pts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Matière :</span>
                    <span className="font-bold text-slate-800">{selectedSubject}</span>
                  </div>
                </div>

                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => startSession()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition flex items-center space-x-2 shadow-sm"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>Recommencer avec d'autres questions</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('home')}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl text-sm font-medium transition"
                  >
                    Accueil
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MES DECKS */}
        {activeTab === 'decks' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Mes Decks de Cours Enregistrés</h2>
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg font-semibold">
                {savedDecks.length} deck(s)
              </span>
            </div>

            {savedDecks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Folder className="w-12 h-12 mx-auto opacity-40" />
                <p className="text-sm">Aucun deck enregistré pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedDecks.map((deck) => (
                  <div key={deck.id} className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition flex justify-between items-center bg-slate-50/50">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium">{deck.subject}</span>
                        <span className="text-xs text-slate-400">{deck.date}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">{deck.title}</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleLoadDeck(deck)}
                        className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium flex items-center space-x-1"
                        title="Lancer"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDeck(deck.id)}
                        className="p-2 bg-slate-200 hover:bg-red-100 text-slate-600 hover:text-red-600 rounded-xl transition"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PARAMÈTRES (CONFIG CLÉ API) */}
        {activeTab === 'settings' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                <span>Paramètres de l'application</span>
              </h2>
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Clé API (Optionnelle - Gemini / OpenAI)</span>
                </div>
                {isKeySavedSuccess && (
                  <span className="text-xs text-green-600 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" /> 
                    <span>Clé enregistrée avec succès !</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Configurez votre clé API externe (ex: Gemini <code>AIzaSy...</code> ou OpenAI) pour propulser l'analyse de cours par l'intelligence artificielle. Si vous laissez ce champ vide, c'est le moteur local intégré qui générera instantanément les quiz.
              </p>

              <div className="flex items-center space-x-2 bg-white px-3 py-2.5 rounded-xl border border-slate-200 shadow-inner">
                <Key className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                  placeholder="Collez votre clé API ici..."
                  className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 placeholder-slate-400 font-mono"
                />
                <button 
                  onClick={() => handleSaveApiKey(apiKey)} 
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center space-x-1 transition flex-shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Enregistrer</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
