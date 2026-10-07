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
  Image as ImageIcon
} from 'lucide-react';

// Helper to convert a File object to base64 object with mimeType
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const resultStr = reader.result;
      const base64String = resultStr.split(',')[1];
      resolve({
        data: base64String,
        mimeType: file.type || 'image/jpeg',
        previewUrl: resultStr
      });
    };
    reader.onerror = (error) => reject(error);
  });
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
  // Application State navigation: 'library', 'create', 'loading', 'quiz', 'result', 'error'
  const [appState, setAppState] = useState('library');
  const [selectedLanguage, setSelectedLanguage] = useState('French');
  const [selectedSubject, setSelectedSubject] = useState('autre');
  const [activeTabSubject, setActiveTabSubject] = useState('ALL'); // 'ALL' or subject.id
  
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);
  const [courses, setCourses] = useState([]);
  const [activeCourseId, setActiveCourseId] = useState(null);
  
  // Custom new subject state in creation view
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [showCustomSubjectInput, setShowCustomSubjectInput] = useState(false);

  // Multi-photo state
  const [capturedImages, setCapturedImages] = useState([]);

  // Quiz active state
  const [currentQuizData, setCurrentQuizData] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  
  // Modals / Editing state
  const [courseToEdit, setCourseToEdit] = useState(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [editSubjectInput, setEditSubjectInput] = useState('autre');
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef(null);

  // Load saved data on startup
  useEffect(() => {
    try {
      const savedCourses = localStorage.getItem('studysnap_courses');
      if (savedCourses) {
        setCourses(JSON.parse(savedCourses));
      }
      const savedSubjects = localStorage.getItem('studysnap_subjects');
      if (savedSubjects) {
        setSubjects(JSON.parse(savedSubjects));
      }
    } catch (e) {
      console.error("Failed to load saved data:", e);
    }
  }, []);

  // Save courses
  const saveCoursesToStorage = (updatedCourses) => {
    setCourses(updatedCourses);
    try {
      localStorage.setItem('studysnap_courses', JSON.stringify(updatedCourses));
    } catch (e) {
      console.error("Failed to save courses:", e);
    }
  };

  // Save subjects
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

    try {
      const convertedImages = await Promise.all(files.map(f => fileToBase64(f)));
      setCapturedImages(prev => [...prev, ...convertedImages]);
    } catch (err) {
      console.error("Error loading images:", err);
    }
    // Reset file input so user can add the same image again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setCapturedImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleGenerateQuiz = async () => {
    if (capturedImages.length === 0) return;

    setAppState('loading');
    setErrorMessage('');

    try {
      const prompt = `Act as an expert teacher. Read all the attached study note pages/images provided together. Analyze all pages continuously to synthesize the full material and generate a comprehensive 5-question multiple-choice quiz covering key concepts across all pages. 
      IMPORTANT RULES:
      1. Generate ALL questions, options, and text ENTIRELY in ${selectedLanguage}.
      2. Provide exactly 4 distinct options per question.
      3. Make sure 'correctAnswer' perfectly matches one of the 'options'.
      4. Derive a short, relevant course title (maximum 4 words) synthesizing the topic across all pages and set it in 'courseTitle'.
      5. If no notes are detected, create a 5-question general study quiz in ${selectedLanguage} and set 'courseTitle' to 'Quiz Général'.`;

      // Build inlineData objects for all captured images
      const imageParts = capturedImages.map(img => ({
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
              ...imageParts
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

      const apiKey = ""; // Injected by engine at runtime
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API Request failed with status ${response.status}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 && result.candidates[0].content) {
        const jsonText = result.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(jsonText);

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
          
          // Clear captured images after success
          setCapturedImages([]);
          startCourseQuiz(newCourse);
        } else {
          throw new Error("Format de données invalide reçu.");
        }
      } else {
        throw new Error("Aucun contenu généré.");
      }

    } catch (error) {
      console.error("Error generating quiz:", error);
      setErrorMessage("Impossible d'analyser ces images. Assurez-vous qu'elles contiennent du texte lisible.");
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
        // Update best score
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

  // ---------------- RENDERS ---------------- //

  const renderLibraryScreen = () => (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Mes Cours</h1>
          <p className="text-xs font-semibold text-slate-400">
            {courses.length} {courses.length > 1 ? 'cours enregistrés' : 'cours enregistré'}
          </p>
        </div>
        <button 
          onClick={() => {
            setCapturedImages([]);
            setAppState('create');
          }}
          className="flex items-center gap-1.5 bg-violet-500 hover:bg-violet-600 text-white font-bold text-sm py-2 px-3.5 rounded-xl shadow-[0_3px_0_0_#7c3aed] active:shadow-none active:translate-y-[3px] transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Scanner</span>
        </button>
      </div>

      {/* Search Bar */}
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

      {/* Subject Filter Tabs */}
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

      {/* Course List */}
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

                  {/* Actions */}
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
    </div>
  );

  const renderCreateScreen = () => (
    <div className="flex flex-col justify-between h-full py-1 animate-in slide-in-from-right duration-300 overflow-y-auto no-scrollbar">
      {/* Top Bar with back button */}
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
            Prenez une ou plusieurs photos de vos pages de cours !
          </p>
        </div>
      </div>

      {/* Captured Photos Gallery */}
      <div className="w-full my-2 bg-white p-3 rounded-2xl border-2 border-slate-100 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-slate-600 font-bold text-xs">
          <div className="flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-violet-500" />
            <span>Pages capturées ({capturedImages.length})</span>
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

        {capturedImages.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-slate-400 text-xs">
            Aucune photo ajoutée pour l'instant. Prenez vos pages en photo ci-dessous.
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
            {capturedImages.map((img, idx) => (
              <div key={idx} className="relative flex-shrink-0 group">
                <img 
                  src={img.previewUrl} 
                  alt={`Page ${idx + 1}`} 
                  className="w-20 h-24 object-cover rounded-xl border border-slate-200 shadow-sm"
                />
                <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                  Page {idx + 1}
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

      {/* Subject Selector */}
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
                placeholder="Nom de la nouvelle matière..."
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

      {/* Language Selector */}
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

      {/* Action Buttons */}
      <div className="w-full mt-2 mb-1 flex flex-col gap-2">
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          multiple
          className="hidden" 
          ref={fileInputRef}
          onChange={handleImageSelection}
        />
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-sm hover:bg-slate-700 transition-all"
        >
          <Camera className="w-4 h-4" />
          <span>{capturedImages.length > 0 ? "Ajouter une autre photo" : "Prendre une photo"}</span>
        </button>

        <button 
          onClick={handleGenerateQuiz}
          disabled={capturedImages.length === 0}
          className={`w-full flex items-center justify-center gap-2 font-bold text-base py-3 px-6 rounded-2xl transition-all ${
            capturedImages.length > 0
              ? 'bg-violet-500 text-white shadow-[0_4px_0_0_#7c3aed] active:shadow-none active:translate-y-[4px]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>Générer le Quiz ({capturedImages.length} page{capturedImages.length > 1 ? 's' : ''})</span>
        </button>
      </div>
    </div>
  );

  const renderLoadingScreen = () => (
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
  );

  const renderQuizScreen = () => {
    const question = currentQuizData[currentQuestionIndex];
    const progress = ((currentQuestionIndex) / currentQuizData.length) * 100;

    return (
      <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
        {/* Header & Progress */}
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
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-100 p-5 mb-4">
          <h2 className="text-lg md:text-xl font-bold text-slate-800 leading-snug">
            {question.question}
          </h2>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3 mt-auto pb-2">
          {question.options.map((option, index) => {
            let buttonClass = "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 shadow-[0_3px_0_0_#e2e8f0]";
            let icon = null;

            if (selectedAnswer) {
              if (option === question.correctAnswer) {
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
    );
  };

  const renderResultScreen = () => {
    const percentage = Math.round((score / currentQuizData.length) * 100);
    let message = "Excellent travail !";
    if (percentage < 50) message = "Continuez à réviser !";
    else if (percentage < 80) message = "Presque parfait !";

    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in zoom-in duration-300">
        <div className="relative">
          <svg className="w-40 h-40 transform -rotate-90">
            <circle
              cx="80" cy="80" r="68"
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth="10"
            />
            <circle
              cx="80" cy="80" r="68"
              fill="transparent"
              stroke="#10b981"
              strokeWidth="10"
              strokeDasharray={68 * 2 * Math.PI}
              strokeDashoffset={(68 * 2 * Math.PI) - ((percentage / 100) * (68 * 2 * Math.PI))}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-slate-800">{score}/{currentQuizData.length}</span>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">{message}</h2>
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
    );
  };

  const renderErrorScreen = () => (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
      <div className="bg-rose-100 p-3 rounded-full">
        <AlertCircle className="w-10 h-10 text-rose-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-800">Oups !</h2>
      <p className="text-slate-600 text-xs px-2">{errorMessage}</p>
      <button 
        onClick={() => setAppState('library')}
        className="mt-4 flex items-center justify-center gap-2 bg-slate-800 text-white font-bold text-sm py-2.5 px-5 rounded-xl"
      >
        Retour à mes cours
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center items-center p-3 font-sans">
      {/* Mobile-sized container acting as smartphone screen */}
      <div className="w-full max-w-md h-[800px] max-h-[92vh] bg-[#f8fafc] rounded-[2.5rem] shadow-2xl overflow-hidden relative border-[8px] border-white flex flex-col">
        
        {/* Smartphone top bar handle */}
        <div className="h-5 w-full flex justify-center items-end bg-white pb-1 rounded-t-[2rem]">
          <div className="w-14 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-5 overflow-y-auto">
          {appState === 'library' && renderLibraryScreen()}
          {appState === 'create' && renderCreateScreen()}
          {appState === 'loading' && renderLoadingScreen()}
          {appState === 'quiz' && renderQuizScreen()}
          {appState === 'result' && renderResultScreen()}
          {appState === 'error' && renderErrorScreen()}
        </div>

        {/* Edit Modal overlay */}
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
