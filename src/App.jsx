import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Play, 
  RefreshCw, 
  Check, 
  X, 
  Sparkles, 
  AlertCircle, 
  BookOpen, 
  Globe, 
  Trash2, 
  Edit3, 
  Plus, 
  Calendar, 
  Trophy, 
  ChevronLeft,
  Search,
  FolderOpen,
  Tag,
  FolderPlus,
  Layers,
  Image as ImageIcon,
  Key,
  HelpCircle,
  Loader2,
  FileText
} from 'lucide-react';

/**
 * Redimensionne et compresse l'image pour le web mobile.
 */
const processAndCompressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1600; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64Data = compressedDataUrl.split(',')[1];

        resolve({
          data: base64Data,
          mimeType: 'image/jpeg',
          previewUrl: compressedDataUrl,
          name: file.name
        });
      };
      img.onerror = () => reject(new Error("Impossible de charger l'image sélectionnée."));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier photo."));
  });
};

const processUploadedFile = async (file) => {
  if (file.type === 'application/pdf') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result.split(',')[1];
        resolve({
          data: base64Data,
          mimeType: 'application/pdf',
          previewUrl: null,
          isPdf: true,
          name: file.name
        });
      };
      reader.onerror = () => reject(new Error("Erreur lors de la lecture du fichier PDF."));
      reader.readAsDataURL(file);
    });
  }
  return processAndCompressImage(file);
};

const LANGUAGES = [
  { code: 'French', label: 'Français', flag: '🇫🇷' },
  { code: 'English', label: 'English', flag: '🇬🇧' },
  { code: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { code: 'German', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'Italian', label: 'Italiano', flag: '🇮🇹' },
  { code: 'Portuguese', label: 'Português', flag: '🇵🇹' }
];

const DEFAULT_SUBJECTS = [
  { id: 'maths', name: 'Mathématiques', icon: '📐', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'histoire', name: 'Histoire-Géo', icon: '🌍', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'svt', name: 'SVT', icon: '🧬', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'physique', name: 'Physique-Chimie', icon: '⚡', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'francais', name: 'Français', icon: '📚', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { id: 'anglais', name: 'Anglais', icon: '🇬🇧', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { id: 'autre', name: 'Autre', icon: '📝', color: 'bg-slate-100 text-slate-700 border-slate-200' }
];

export default function StudySnapApp() {
  const [appState, setAppState] = useState('library');
  const [selectedLanguage, setSelectedLanguage] = useState('French');
  const [selectedSubject, setSelectedSubject] = useState('autre');
  const [activeTabSubject, setActiveTabSubject] = useState('ALL');
  
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);
  const [courses, setCourses] = useState([]);
  const [activeCourseId, setActiveCourseId] = useState(null);
  
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [showCustomSubjectInput, setShowCustomSubjectInput] = useState(false);

  const [capturedImages, setCapturedImages] = useState([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);

  const [currentQuizData, setCurrentQuizData] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  
  const [courseToEdit, setCourseToEdit] = useState(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [editSubjectInput, setEditSubjectInput] = useState('autre');
  const [searchQuery, setSearchQuery] = useState('');

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const savedCourses = localStorage.getItem('studysnap_courses');
      if (savedCourses) setCourses(JSON.parse(savedCourses));
      const savedSubjects = localStorage.getItem('studysnap_subjects');
      if (savedSubjects) setSubjects(JSON.parse(savedSubjects));
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) {
        const cleanSavedKey = savedKey.replace(/[\s"']/g, '');
        setGeminiApiKey(cleanSavedKey);
        setApiKeyInput(cleanSavedKey);
      }
    } catch (e) {
      console.error("Failed to load saved data:", e);
    }
  }, []);

  const saveApiKey = (key) => {
    const cleanedKey = key.replace(/[\s"']/g, '');
    setGeminiApiKey(cleanedKey);
    setApiKeyInput(cleanedKey);
    localStorage.setItem('gemini_api_key', cleanedKey);
    setShowKeyModal(false);
  };

  const clearApiKey = () => {
    setGeminiApiKey('');
    setApiKeyInput('');
    localStorage.removeItem('gemini_api_key');
  };

  const saveCoursesToStorage = (updatedCourses) => {
    setCourses(updatedCourses);
    try {
      localStorage.setItem('studysnap_courses', JSON.stringify(updatedCourses));
    } catch (e) {
      console.error("Failed to save courses:", e);
    }
  };

  const saveSubjectsToStorage = (updatedSubjects) => {
    setSubjects(updatedSubjects);
    try {
      localStorage.setItem('studysnap_subjects', JSON.stringify(updatedSubjects));
    } catch (e) {
      console.error("Failed to save subjects:", e);
    }
  };

  const handleAddNewSubject = () => {
    if (!customSubjectName.trim()) return;
    const newSub = {
      id: 'sub_' + Date.now(),
      name: customSubjectName.trim(),
      icon: '📌',
      color: 'bg-violet-100 text-violet-700 border-violet-200'
    };
    const updated = [...subjects, newSub];
    saveSubjectsToStorage(updated);
    setSelectedSubject(newSub.id);
    setCustomSubjectName('');
    setShowCustomSubjectInput(false);
  };

  const handleImageSelection = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsProcessingPhotos(true);
    try {
      const convertedFiles = await Promise.all(files.map(f => processUploadedFile(f)));
      setCapturedImages(prev => [...prev, ...convertedFiles]);
    } catch (err) {
      console.error("Erreur lors du traitement des fichiers :", err);
      alert("Erreur lors du traitement du fichier. Veuillez réessayer.");
    } finally {
      setIsProcessingPhotos(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setCapturedImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const generateDemoQuiz = () => {
    const subObj = getSubjectObj(selectedSubject);
    const demoQuestions = [
      {
        question: `[Mode Démo] Quelle est la méthode clé pour mémoriser vos cours de ${subObj.name} ?`,
        options: [
          "Se tester régulièrement avec des quiz espacés",
          "Relire son cours une seule fois avant l'examen",
          "Recopier mot à mot sans chercher à comprendre",
          "Ne réviser que le matin du contrôle"
        ],
        correctAnswer: "Se tester régulièrement avec des quiz espacés"
      }
    ];

    const newCourse = {
      id: Date.now().toString(),
      title: `Cours ${subObj.name} (Démo)`,
      createdAt: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
      language: selectedLanguage,
      subjectId: selectedSubject,
      questions: demoQuestions,
      pageCount: capturedImages.length || 1,
      bestScore: null
    };

    const updated = [newCourse, ...courses];
    saveCoursesToStorage(updated);
    setCapturedImages([]);
    startCourseQuiz(newCourse);
  };

  const discoverWorkingModels = async (cleanKey) => {
    const apiVersions = ['v1beta', 'v1'];
    let lastGoogleError = '';

    for (const ver of apiVersions) {
      try {
        const listUrl = `https://generativelanguage.googleapis.com/${ver}/models?key=${cleanKey}`;
        const res = await fetch(listUrl);
        
        if (res.ok) {
          const data = await res.json();
          const models = (data.models || [])
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''));

          if (models.length > 0) {
            const flashModels = models.filter(m => m.includes('flash')).sort((a, b) => {
              if (a.includes('3.8')) return -1;
              if (b.includes('3.8')) return 1;
              if (a.includes('3.5')) return -1;
              if (b.includes('3.5')) return 1;
              if (a.includes('2.0')) return -1;
              if (b.includes('2.0')) return 1;
              return 0;
            });

            if (flashModels.length > 0) {
              return { modelsList: flashModels, apiVersion: ver };
            }
            return { modelsList: [models[0]], apiVersion: ver };
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          if (errData?.error?.message) {
            lastGoogleError = errData.error.message;
          }
        }
      } catch (err) {
        lastGoogleError = err.message;
      }
    }

    if (lastGoogleError && (lastGoogleError.toLowerCase().includes('api key not valid') || lastGoogleError.toLowerCase().includes('invalid'))) {
      throw new Error(`Refusé par Google: ${lastGoogleError}`);
    }
    
    return { modelsList: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'], apiVersion: 'v1beta' };
  };

  const handleGenerateQuiz = async () => {
    if (capturedImages.length === 0) return;

    const apiKey = geminiApiKey.replace(/[\s"']/g, '');

    if (!apiKey) {
      setShowKeyModal(true);
      return;
    }

    setAppState('loading');
    setErrorMessage('');

    try {
      const { modelsList, apiVersion } = await discoverWorkingModels(apiKey);

      const prompt = `Agis comme un professeur expert. Lis attentivement les notes de cours et documents joints. Analyse l'ensemble des pages et fichiers de manière continue pour synthétiser le contenu et génère un quiz de révision pertinent de 5 questions à choix multiples couvrant les notions clés.
RÈGLES IMPORTANTES :
1. Rédige TOUTES les questions, propositions et textes INTÉGRALEMENT en ${selectedLanguage}.
2. Propose exactement 4 options distinctes par question.
3. Le champ 'correctAnswer' doit être STRICTEMENT identique à l'une des 4 options de 'options'.
4. Déduis un titre de cours court et pertinent (4 mots maximum) résumant le sujet dans 'courseTitle'.
5. Si les documents sont illisibles, génère un quiz pédagogique de 5 questions sur le sujet général sélectionné (${getSubjectObj(selectedSubject).name}).`;

      const mediaParts = capturedImages.map(img => ({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data
        }
      }));

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...mediaParts
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              courseTitle: { type: "STRING" },
              questions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    question: { type: "STRING" },
                    options: {
                      type: "ARRAY",
                      items: { type: "STRING" }
                    },
                    correctAnswer: { type: "STRING" }
                  },
                  required: ["question", "options", "correctAnswer"]
                }
              }
            },
            required: ["courseTitle", "questions"]
          }
        }
      };

      let apiResponse = null;
      let lastLoopError = "";

      for (const model of modelsList) {
        try {
          const apiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            let errorDetail = `Erreur ${response.status}`;
            try {
              const errData = await response.json();
              if (errData?.error?.message) {
                errorDetail = errData.error.message;
              }
            } catch (_) {}

            // Affichage explicite de l'erreur renvoyée par Google au lieu du message générique
            if (response.status === 400 || response.status === 401 || response.status === 403) {
              throw new Error(`Erreur d'accès Google (${response.status}) : ${errorDetail}`);
            } else if (response.status === 413) {
              throw new Error("Les photos sont trop volumineuses. Réduisez le nombre de pages.");
            } else if (response.status === 503 || response.status === 429 || errorDetail.toLowerCase().includes('high demand') || errorDetail.toLowerCase().includes('overloaded')) {
              throw new Error(`HIGH_DEMAND`);
            } else {
              throw new Error(`Google AI (${model}) : ${errorDetail}`);
            }
          }

          apiResponse = await response.json();
          break; 

        } catch (error) {
          if (error.message === 'HIGH_DEMAND') {
            lastLoopError = "Les serveurs de Google sont très sollicités. Veuillez réessayer.";
            continue; 
          } else {
            throw error; 
          }
        }
      }

      if (!apiResponse) {
        throw new Error(lastLoopError || "Impossible de joindre l'IA de Google pour le moment. Veuillez réessayer dans quelques minutes.");
      }

      const result = apiResponse;

      if (result.candidates && result.candidates.length > 0 && result.candidates[0].content) {
        const rawPart = result.candidates[0].content.parts[0].text;
        const jsonCleaned = rawPart.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(jsonCleaned);

        if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          const newCourse = {
            id: Date.now().toString(),
            title: parsed.courseTitle || 'Mon nouveau cours',
            createdAt: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
            language: selectedLanguage,
            subjectId: selectedSubject,
            questions: parsed.questions,
            pageCount: capturedImages.length,
            bestScore: null
          };

          const updated = [newCourse, ...courses];
          saveCoursesToStorage(updated);
          
          setCapturedImages([]);
          startCourseQuiz(newCourse);
        } else {
          throw new Error("Le format du quiz renvoyé n'a pas pu être interprété.");
        }
      } else {
        throw new Error("Aucune réponse générée par l'IA.");
      }

    } catch (error) {
      console.error("Error generating quiz:", error);
      setErrorMessage(error.message || "Impossible d'analyser ces images pour le moment.");
      setAppState('error');
    }
  };

  const startCourseQuiz = (course) => {
    setActiveCourseId(course.id);
    setCurrentQuizData(course.questions);
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setAppState('quiz');
  };

  const handleAnswerSelect = (option) => {
    if (selectedAnswer) return;

    const currentQuestion = currentQuizData[currentQuestionIndex];
    const correct = option === currentQuestion.correctAnswer;

    setSelectedAnswer(option);
    setIsCorrect(correct);

    const newScore = correct ? score + 1 : score;
    if (correct) {
      setScore(newScore);
    }

    setTimeout(() => {
      if (currentQuestionIndex < currentQuizData.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setIsCorrect(null);
      } else {
        if (activeCourseId) {
          const updatedCourses = courses.map(c => {
            if (c.id === activeCourseId) {
              const best = c.bestScore === null ? newScore : Math.max(c.bestScore, newScore);
              return { ...c, bestScore: best };
            }
            return c;
          });
          saveCoursesToStorage(updatedCourses);
        }
        setAppState('result');
      }
    }, 1200);
  };

  const deleteCourse = (id, e) => {
    e.stopPropagation();
    const updated = courses.filter(c => c.id !== id);
    saveCoursesToStorage(updated);
  };

  const openEditModal = (course, e) => {
    e.stopPropagation();
    setCourseToEdit(course);
    setEditTitleInput(course.title);
    setEditSubjectInput(course.subjectId || 'autre');
  };

  const handleEditSave = () => {
    if (!editTitleInput.trim()) return;
    const updated = courses.map(c => 
      c.id === courseToEdit.id ? { ...c, title: editTitleInput.trim(), subjectId: editSubjectInput } : c
    );
    saveCoursesToStorage(updated);
    setCourseToEdit(null);
  };

  const getSubjectObj = (id) => {
    return subjects.find(s => s.id === id) || { name: 'Matière', icon: '📝', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = activeTabSubject === 'ALL' || c.subjectId === activeTabSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex justify-center font-sans antialiased text-slate-800">
      <div className="w-full min-h-[100dvh] bg-[#f8fafc] flex flex-col relative px-4 pt-3 pb-6">
        <div className="flex-1 flex flex-col overflow-y-auto">
          {appState === 'library' && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">Mes Cours</h1>
                  <p className="text-xs font-semibold text-slate-400">
                    {courses.length} {courses.length > 1 ? 'cours enregistrés' : 'cours enregistré'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowKeyModal(true)}
                    className={`p-2.5 rounded-xl border transition-all ${
                      geminiApiKey 
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                        : 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 animate-pulse'
                    }`}
                  >
                    <Key className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {courses.length > 0 && (
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input 
                    type="text"
                    placeholder="Rechercher un cours..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-100 text-slate-700 pl-10 pr-4 py-2 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-violet-300 transition-all"
                  />
                </div>
              )}

              <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
                <button
                  onClick={() => setActiveTabSubject('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    activeTabSubject === 'ALL'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  Tous ({courses.length})
                </button>
                {subjects.map(sub => {
                  const count = courses.filter(c => c.subjectId === sub.id).length;
                  if (count === 0 && activeTabSubject !== sub.id) return null;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setActiveTabSubject(sub.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                        activeTabSubject === sub.id
                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span>{sub.icon}</span>
                      <span>{sub.name}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTabSubject === sub.id ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
                {courses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
                    <div className="bg-violet-50 p-4 rounded-full">
                      <FolderOpen className="w-10 h-10 text-violet-400" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-700">Aucun cours disponible</p>
                      <p className="text-xs text-slate-400 mt-1">Prenez en photo une ou plusieurs pages de cours pour créer un quiz !</p>
                    </div>
                    <button 
                      onClick={() => {
                        setCapturedImages([]);
                        setAppState('create');
                      }}
                      className="mt-2 bg-violet-500 text-white font-bold text-sm py-2.5 px-5 rounded-xl shadow-[0_4px_0_0_#7c3aed] active:translate-y-[4px] transition-all"
                    >
                      Ajouter un cours
                    </button>
                  </div>
                ) : filteredCourses.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm font-medium">
                    Aucun cours trouvé dans cette catégorie.
                  </div>
                ) : (
                  filteredCourses.map(course => {
                    const sub = getSubjectObj(course.subjectId);
                    return (
                      <div 
                        key={course.id}
                        onClick={() => startCourseQuiz(course)}
                        className="bg-white p-4 rounded-2xl border-2 border-slate-100 hover:border-violet-200 shadow-sm hover:shadow transition-all relative cursor-pointer group flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2.5 rounded-xl border font-bold text-base ${sub.color}`}>
                              {sub.icon}
                            </div>
                            <div>
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border mb-1 ${sub.color}`}>
                                {sub.name}
                              </span>
                              <h3 className="font-bold text-slate-800 text-base leading-tight group-hover:text-violet-600 transition-colors">
                                {course.title}
                              </h3>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3" /> {course.createdAt} • {course.questions.length} Questions {course.pageCount ? `• ${course.pageCount} page(s)` : ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={(e) => openEditModal(course, e)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={(e) => deleteCourse(course.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {LANGUAGES.find(l => l.code === course.language)?.flag || '🇫🇷'} {course.language}
                          </span>
                          <div className="flex items-center gap-1 text-xs font-extrabold text-amber-500">
                            <Trophy className="w-3.5 h-3.5" />
                            <span>
                              {course.bestScore !== null ? `${course.bestScore}/${course.questions.length}` : 'Jamais joué'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {courses.length > 0 && (
                <div className="pt-2 mt-auto sticky bottom-0 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/95 to-transparent pb-1">
                  <button 
                    onClick={() => {
                      setCapturedImages([]);
                      setAppState('create');
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-[0_3px_0_0_#6d28d9] active:translate-y-[2px] transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un cours</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {appState === 'create' && (
            <div className="flex flex-col justify-between h-full py-1 animate-in slide-in-from-right duration-300 overflow-y-auto no-scrollbar">
              <div className="w-full flex items-center justify-between mb-1">
                <button 
                  onClick={() => setAppState('library')}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-all"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <span className="text-sm font-bold text-slate-700">Nouveau cours (Multi-photos)</span>
                <div className="w-6"></div>
              </div>

              <div className="flex flex-col items-center space-y-2 text-center my-1">
                <div className="bg-violet-100 p-3 rounded-full shadow-inner">
                  <Sparkles className="w-8 h-8 text-violet-500" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800">Scanner vos documents</h2>
                  <p className="text-slate-500 text-xs max-w-xs mx-auto mt-0.5">
                    Prenez vos pages en photo ou importez vos PDF.
                  </p>
                </div>
              </div>

              <div className="w-full my-2 bg-white p-3 rounded-2xl border-2 border-slate-100 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-600 font-bold text-xs">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-violet-500" />
                    <span>Fichiers & pages ({capturedImages.length})</span>
                  </div>
                  {capturedImages.length > 0 && (
                    <button 
                      onClick={() => setCapturedImages([])}
                      className="text-rose-500 hover:underline text-[11px] font-semibold"
                    >
                      Tout effacer
                    </button>
                  )}
                </div>

                {isProcessingPhotos ? (
                  <div className="flex items-center justify-center p-6 text-violet-600 gap-2 text-xs font-semibold">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Préparation du fichier...</span>
                  </div>
                ) : capturedImages.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-slate-400 text-xs">
                    Aucun document ou photo pour l'instant. Choisissez une option ci-dessous.
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
                    {capturedImages.map((img, idx) => (
                      <div key={idx} className="relative flex-shrink-0 group">
                        {img.isPdf ? (
                          <div className="w-20 h-24 rounded-xl border border-red-200 bg-red-50 p-2 flex flex-col items-center justify-center text-center shadow-sm">
                            <FileText className="w-7 h-7 text-red-500 mb-1" />
                            <span className="text-[9px] font-bold text-red-700 truncate w-full px-1">
                              {img.name || 'Cours.pdf'}
                            </span>
                            <span className="text-[8px] font-extrabold text-red-400 uppercase mt-0.5">PDF</span>
                          </div>
                        ) : (
                          <img 
                            src={img.previewUrl} 
                            alt={`Page ${idx + 1}`} 
                            className="w-20 h-24 object-cover rounded-xl border border-slate-200 shadow-sm"
                          />
                        )}
                        <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                          {img.isPdf ? 'Doc' : `Page ${idx + 1}`}
                        </span>
                        <button
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-1 shadow-md hover:bg-rose-600 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-full my-1">
                <div className="bg-white p-3 rounded-2xl border-2 border-slate-100 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-slate-600 font-bold text-xs">
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-violet-500" />
                      <span>Choisir la Matière</span>
                    </div>
                    <button 
                      onClick={() => setShowCustomSubjectInput(!showCustomSubjectInput)}
                      className="text-violet-600 hover:underline text-[11px] flex items-center gap-1 font-semibold"
                    >
                      <FolderPlus className="w-3 h-3" />
                      <span>+ Créer</span>
                    </button>
                  </div>

                  {showCustomSubjectInput && (
                    <div className="flex gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 mb-2">
                      <input 
                        type="text"
                        placeholder="Nouvelle matière..."
                        value={customSubjectName}
                        onChange={(e) => setCustomSubjectName(e.target.value)}
                        className="flex-1 bg-white px-2 py-1 rounded-lg text-xs border border-slate-200 outline-none"
                      />
                      <button 
                        onClick={handleAddNewSubject}
                        className="bg-violet-500 text-white text-xs px-3 font-bold rounded-lg"
                      >
                        Ajouter
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {subjects.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSubject(sub.id)}
                        className={`flex items-center gap-2 p-1.5 rounded-xl font-semibold text-xs transition-all border ${
                          selectedSubject === sub.id
                            ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm'
                            : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'
                        }`}
                      >
                        <span>{sub.icon}</span>
                        <span className="truncate">{sub.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-full my-1">
                <div className="bg-white p-3 rounded-2xl border-2 border-slate-100 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                    <Globe className="w-3.5 h-3.5 text-violet-500" />
                    <span>Langue du Quiz</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => setSelectedLanguage(lang.code)}
                        className={`flex items-center gap-2 p-1.5 rounded-xl font-semibold text-xs transition-all border ${
                          selectedLanguage === lang.code
                            ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm'
                            : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'
                        }`}
                      >
                        <span className="text-sm">{lang.flag}</span>
                        <span>{lang.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-full mt-2 mb-1 flex flex-col gap-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  ref={cameraInputRef}
                  onChange={handleImageSelection}
                />
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  multiple
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageSelection}
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isProcessingPhotos}
                    className="flex items-center justify-center gap-2 bg-slate-800 text-white font-bold text-xs py-3 px-3 rounded-xl shadow-sm hover:bg-slate-700 transition-all disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4 text-violet-400" />
                    <span>Prendre photo</span>
                  </button>

                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingPhotos}
                    className="flex items-center justify-center gap-2 bg-white text-slate-700 border-2 border-slate-200 font-bold text-xs py-3 px-3 rounded-xl shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4 text-violet-500" />
                    <span>Fichier / Galerie</span>
                  </button>
                </div>

                <button 
                  onClick={handleGenerateQuiz}
                  disabled={capturedImages.length === 0 || isProcessingPhotos}
                  className={`w-full flex items-center justify-center gap-2 font-bold text-base py-3 px-6 rounded-2xl transition-all ${
                    capturedImages.length > 0 && !isProcessingPhotos
                      ? 'bg-violet-500 text-white shadow-[0_4px_0_0_#7c3aed] active:shadow-none active:translate-y-[4px]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Générer le Quiz ({capturedImages.length} doc{capturedImages.length > 1 ? 's' : ''})</span>
                </button>
              </div>
            </div>
          )}

          {appState === 'loading' && (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <div className="relative w-28 h-28">
                <div className="absolute inset-0 border-8 border-violet-200 rounded-full"></div>
                <div className="absolute inset-0 border-8 border-violet-500 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-violet-500">
                  <BookOpen className="w-8 h-8 animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-700 animate-pulse">
                  L'IA analyse vos {capturedImages.length} page(s)...
                </h2>
                <p className="text-violet-500 text-xs font-semibold mt-1">
                  Création du quiz en {LANGUAGES.find(l => l.code === selectedLanguage)?.label} ({getSubjectObj(selectedSubject).name})
                </p>
              </div>
            </div>
          )}

          {appState === 'quiz' && (
            <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
              <div className="mb-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                  <button 
                    onClick={() => setAppState('library')} 
                    className="flex items-center text-slate-400 hover:text-slate-700"
                  >
                    <ChevronLeft className="w-4 h-4" /> Quitter
                  </button>
                  <span>Question {currentQuestionIndex + 1} / {currentQuizData.length}</span>
                  <span className="flex items-center gap-1 text-amber-500">
                    <Sparkles className="w-3.5 h-3.5" /> Score: {score}
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-violet-500 transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${((currentQuestionIndex) / currentQuizData.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-100 p-5 mb-4">
                <h2 className="text-lg md:text-xl font-bold text-slate-800 leading-snug">
                  {currentQuizData[currentQuestionIndex].question}
                </h2>
              </div>

              <div className="flex flex-col gap-3 mt-auto pb-2">
                {currentQuizData[currentQuestionIndex].options.map((option, index) => {
                  let buttonClass = "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 shadow-[0_3px_0_0_#e2e8f0]";
                  let icon = null;

                  if (selectedAnswer) {
                    if (option === currentQuizData[currentQuestionIndex].correctAnswer) {
                      buttonClass = "bg-emerald-100 border-2 border-emerald-500 text-emerald-800 shadow-[0_3px_0_0_#10b981]";
                      icon = <Check className="w-5 h-5 text-emerald-600" />;
                    } else if (option === selectedAnswer) {
                      buttonClass = "bg-rose-100 border-2 border-rose-500 text-rose-800 shadow-[0_3px_0_0_#f43f5e]";
                      icon = <X className="w-5 h-5 text-rose-600" />;
                    } else {
                      buttonClass = "bg-slate-50 border-2 border-slate-200 text-slate-400 opacity-50 shadow-none translate-y-[3px]";
                    }
                  } else {
                    buttonClass = "bg-white border-2 border-slate-200 text-slate-700 active:shadow-none active:translate-y-[3px] shadow-[0_3px_0_0_#e2e8f0] hover:border-violet-300";
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(option)}
                      disabled={!!selectedAnswer}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl font-semibold text-left transition-all duration-200 text-sm ${buttonClass}`}
                    >
                      <span>{option}</span>
                      {icon}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {appState === 'result' && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in zoom-in duration-300">
              <div className="relative">
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle cx="80" cy="80" r="68" fill="transparent" stroke="#e2e8f0" strokeWidth="10" />
                  <circle
                    cx="80" cy="80" r="68" fill="transparent" stroke="#10b981" strokeWidth="10"
                    strokeDasharray={68 * 2 * Math.PI}
                    strokeDashoffset={(68 * 2 * Math.PI) - (((score / currentQuizData.length) * 100) / 100) * (68 * 2 * Math.PI)}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-slate-800">{score}/{currentQuizData.length}</span>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-1">
                  {((score / currentQuizData.length) * 100) < 50 ? "Continuez à réviser !" : ((score / currentQuizData.length) * 100) < 80 ? "Presque parfait !" : "Excellent travail !"}
                </h2>
                <p className="text-slate-500 text-sm">Score enregistré dans votre bibliothèque.</p>
              </div>
              <div className="w-full flex flex-col gap-2 pt-4">
                <button 
                  onClick={() => {
                    const course = courses.find(c => c.id === activeCourseId);
                    if (course) startCourseQuiz(course);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-violet-500 text-white font-bold text-base py-3 px-6 rounded-xl shadow-[0_4px_0_0_#7c3aed] active:translate-y-[4px] transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Recommencer ce quiz
                </button>
                <button 
                  onClick={() => setAppState('library')}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold text-base py-3 px-6 rounded-xl hover:bg-slate-200 transition-all"
                >
                  Retour à mes cours
                </button>
              </div>
            </div>
          )}

          {appState === 'error' && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="bg-rose-100 p-3 rounded-full">
                <AlertCircle className="w-10 h-10 text-rose-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Oups !</h2>
              {/* C'est ici que l'erreur EXACTE de Google va s'afficher */}
              <p className="text-rose-600 font-mono text-[10px] px-2 bg-rose-50 py-2 rounded-lg text-left break-words max-w-full">
                {errorMessage}
              </p>

              <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
                <button 
                  onClick={() => {
                    setShowKeyModal(true);
                    setAppState('create');
                  }}
                  className="flex items-center justify-center gap-2 bg-violet-600 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-sm hover:bg-violet-700 transition-all"
                >
                  <Key className="w-4 h-4" />
                  <span>Vérifier ma clé API Gemini</span>
                </button>
                <button 
                  onClick={() => setAppState('create')}
                  className="mt-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl hover:bg-slate-200"
                >
                  Retour
                </button>
              </div>
            </div>
          )}
        </div>

        {showKeyModal && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-5 w-full space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-violet-100 text-violet-600">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Clé API Google Gemini</h3>
                    <p className="text-[11px] text-slate-400">Gratuite sur Google AI Studio</p>
                  </div>
                </div>
                {/* Nouveau bouton pour effacer la clé défectueuse */}
                {geminiApiKey && (
                  <button 
                    onClick={clearApiKey}
                    className="text-[10px] text-rose-500 font-bold hover:underline bg-rose-50 px-2 py-1 rounded-md"
                  >
                    Effacer la clé
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Obtenez gratuitement votre clé API en 1 minute sur{' '}
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-violet-600 font-bold underline"
                >
                  Google AI Studio
                </a>.
              </p>
              <input 
                type="password"
                placeholder="Collez votre clé : AIzaSy..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-slate-800 font-mono text-xs outline-none focus:ring-2 focus:ring-violet-400"
              />
              <div className="flex gap-2 justify-end pt-1">
                <button 
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-2 rounded-xl text-slate-500 font-semibold text-xs hover:bg-slate-100"
                >
                  Fermer
                </button>
                <button 
                  onClick={() => saveApiKey(apiKeyInput)}
                  className="px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs shadow-sm hover:bg-violet-700"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        {courseToEdit && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-5 w-full space-y-4 shadow-xl">
              <h3 className="font-bold text-slate-800 text-base">Modifier le cours</h3>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Titre du cours</label>
                <input 
                  type="text" 
                  value={editTitleInput}
                  onChange={(e) => setEditTitleInput(e.target.value)}
                  className="w-full bg-slate-100 p-3 rounded-xl border border-slate-200 text-slate-800 font-medium text-sm outline-none focus:ring-2 focus:ring-violet-400"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Matière</label>
                <select
                  value={editSubjectInput}
                  onChange={(e) => setEditSubjectInput(e.target.value)}
                  className="w-full bg-slate-100 p-3 rounded-xl border border-slate-200 text-slate-800 font-medium text-sm outline-none focus:ring-2 focus:ring-violet-400"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button 
                  onClick={() => setCourseToEdit(null)}
                  className="px-4 py-2 rounded-xl text-slate-500 font-semibold text-xs hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleEditSave}
                  className="px-4 py-2 rounded-xl bg-violet-500 text-white font-bold text-xs shadow-sm hover:bg-violet-600"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
