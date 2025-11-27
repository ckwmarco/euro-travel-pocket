import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  MapPin, 
  Navigation, 
  Utensils, 
  Train, 
  CreditCard, 
  Trash2, 
  AlertCircle,
  FileText,
  Plane,
  Bus,
  X,
  Sparkles,
  Loader2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Compass,
  Filter,
  List,
  Coins,
  Download,
  Upload,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// --- Types ---

type EventType = 'activity' | 'transport' | 'dining' | 'lodging';

interface TravelEvent {
  id: string;
  title: string;
  location: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  type: EventType;
  notes: string;
  isCashOnly: boolean;
  cost: number; 
  currency: string; // ISO code e.g. 'EUR', 'USD', 'JPY'
  
  // Smart Content
  imageUrl?: string;
  mustDos?: string[];
  warnings?: string[];
  
  // Transport specific
  transportMode?: 'train' | 'bus' | 'flight';
  seatInfo?: string; 
  platform?: string;
  transferInfo?: string; 
  ticketFileRef?: string; 
}

interface ExpenseSummary {
  totalHkd: number;
  details: { [currency: string]: number };
}

interface Suggestion {
  title: string;
  location: string;
  startTime: string; 
  dayOffset: number; 
  type: EventType;
  cost: number;
  currency?: string;
  notes: string;
  reason: string;
}

interface BackupData {
  app: string;
  version: number;
  timestamp: string;
  events: TravelEvent[];
  rates: { [key: string]: number };
}

// --- Constants ---

const DEFAULT_RATES: { [key: string]: number } = {
  'EUR': 8.5,
  'USD': 7.8,
  'GBP': 10.1,
  'JPY': 0.052,
  'KRW': 0.006,
  'TWD': 0.25,
  'CNY': 1.1,
  'HKD': 1.0
};

// --- Helpers ---

const toLocalISOString = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
  return localISOTime;
};

// Robust JSON parser for AI responses
const parseGeminiResponse = (text: string) => {
  try {
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error("No JSON found");
    }
  } catch (error) {
    console.error("JSON Parse Failed:", error);
    throw error;
  }
};

const callGemini = async (prompt: string): Promise<string> => {
  const apiKey = ""; 
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "API Error");
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "";
  }
};

const fetchWikiImage = async (query: string): Promise<string | undefined> => {
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`
    );
    const searchData = await searchRes.json();
    if (!searchData.query?.search?.length) return undefined;
    
    const title = searchData.query.search[0].title;

    const imgRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=600&origin=*`
    );
    const imgData = await imgRes.json();
    const pages = imgData.query?.pages;
    const pageId = Object.keys(pages)[0];
    return pages[pageId]?.thumbnail?.source;
  } catch (e) {
    console.error("Wiki Image Error", e);
    return undefined;
  }
};

// --- UI Components ---

const IOSCard = React.memo(({ children, className = "", onClick = undefined }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/5 overflow-hidden ${className}`}
  >
    {children}
  </div>
));

const IOSButton = ({ onClick, children, variant = 'primary', className = "", disabled = false, ...props }: any) => {
  const baseStyle = "px-4 py-3 rounded-xl font-semibold transition-all active:scale-95 active:opacity-80 flex items-center justify-center gap-2 text-[15px]";
  const variants: any = {
    primary: "bg-[#007AFF] text-white shadow-sm shadow-blue-200",
    secondary: "bg-[#E5E5EA] text-black",
    danger: "bg-[#FF3B30] text-white",
    ghost: "bg-transparent text-[#007AFF] hover:bg-blue-50/50",
    outline: "border border-[#C7C7CC] text-black bg-white",
    magic: "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-sm"
  };
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

const IOSInput = ({ label, value, onChange, type = "text", step, placeholder = "", className = "", rightElement = null }: any) => (
  <div className={`bg-white px-4 py-3 flex items-center justify-between border-b border-[#E5E5EA] last:border-0 ${className}`}>
    <label className="text-[15px] font-medium text-black w-1/3 shrink-0">{label}</label>
    <div className="flex items-center gap-2 w-full justify-end">
      <input 
        type={type}
        step={step}
        className="w-full text-right text-[15px] text-[#8E8E93] focus:text-black placeholder:text-[#C7C7CC] outline-none bg-transparent"
        value={value ?? ""} 
        onChange={onChange}
        placeholder={placeholder}
      />
      {rightElement}
    </div>
  </div>
);

const IOSSegmentedControl = ({ options, selected, onChange }: any) => (
  <div className="bg-[#E5E5EA] p-1 rounded-xl flex">
    {options.map((opt: any) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`flex-1 py-1.5 text-[13px] font-semibold rounded-lg capitalize transition-all ${
          selected === opt.value 
            ? 'bg-white text-black shadow-sm' 
            : 'text-[#8E8E93]'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const SystemModal = ({ 
  isOpen, 
  title, 
  message, 
  type = 'alert', 
  onClose, 
  onConfirm 
}: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  type?: 'alert' | 'confirm'; 
  onClose: () => void; 
  onConfirm?: () => void;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden scale-100">
        <div className="p-6 text-center">
          <h3 className="font-semibold text-lg mb-2">{title}</h3>
          <p className="text-sm text-slate-500">{message}</p>
        </div>
        <div className={`flex border-t border-slate-200 ${type === 'confirm' ? 'divide-x divide-slate-200' : ''}`}>
          {type === 'confirm' && (
            <button 
              onClick={onClose}
              className="flex-1 py-3 text-[15px] text-slate-500 font-medium active:bg-slate-50"
            >
              Cancel
            </button>
          )}
          <button 
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
            className={`flex-1 py-3 text-[15px] font-semibold active:bg-slate-50 ${type === 'confirm' ? 'text-red-600' : 'text-blue-600'}`}
          >
            {type === 'confirm' ? 'Delete' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SmartPasteModal = ({ isOpen, onClose, onProcess }: any) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleProcess = async () => {
    if (!text) return;
    setLoading(true);
    await onProcess(text);
    setLoading(false);
    onClose();
    setText("");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-lg">Magic Import</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4">
          <div className="bg-blue-50 p-3 rounded-lg mb-3 flex gap-2 items-start">
             <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
             <p className="text-xs text-blue-800">
               <strong>Privacy Note:</strong> Paste ticket emails or plans. I'll detect the time, location, cost, and local currency automatically.
             </p>
          </div>
          <textarea 
            className="w-full h-32 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-blue-500"
            placeholder="e.g. 'Sushi lunch in Tokyo at Sukiyabashi Jiro, 12:30 PM, ¥30000'"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="p-4 pt-0">
          <IOSButton variant="magic" onClick={handleProcess} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Auto-Fill Form</>}
          </IOSButton>
        </div>
      </div>
    </div>
  );
};

// New Restore Modal
const RestoreModal = ({ isOpen, onClose, onRestore }: { isOpen: boolean, onClose: () => void, onRestore: (text: string) => void }) => {
  const [text, setText] = useState("");

  if (!isOpen) return null;

  const handleRestore = () => {
    if (!text) return;
    onRestore(text);
    onClose();
    setText("");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-lg">Restore Data</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4">
           <div className="bg-orange-50 p-3 rounded-lg mb-3 flex gap-2 items-start">
             <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
             <p className="text-xs text-orange-800">
               <strong>Warning:</strong> Restoring will <u>replace</u> all your current events and settings.
             </p>
          </div>
          <p className="text-sm text-slate-500 mb-2">Paste the content of your backup file here:</p>
          <textarea 
            className="w-full h-48 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono focus:outline-blue-500"
            placeholder='{"app":"euro-travel-pocket", ...}'
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="p-4 pt-0">
          <IOSButton variant="primary" onClick={handleRestore} disabled={!text} className="w-full">
            <Upload className="w-4 h-4" /> Restore Data
          </IOSButton>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  // --- State ---
  const [events, setEvents] = useState<TravelEvent[]>([]);
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>(DEFAULT_RATES);
  const [view, setView] = useState<'itinerary' | 'add' | 'expenses' | 'suggestions'>('itinerary');
  const [showAllEvents, setShowAllEvents] = useState(true);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  
  // Suggestion State
  const [suggestionParams, setSuggestionParams] = useState({ 
    location: '', 
    startDate: toLocalISOString(new Date()).slice(0, 10),
    endDate: toLocalISOString(new Date(Date.now() + 86400000)).slice(0, 10),
    preferences: ''
  });
  const [generatedSuggestions, setGeneratedSuggestions] = useState<Suggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // Gemini States
  const [isSmartPasteOpen, setIsSmartPasteOpen] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [isEstimatingCost, setIsEstimatingCost] = useState(false);
  const [enhancingEventId, setEnhancingEventId] = useState<string | null>(null);

  // System Modals State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  // Form State
  const [formData, setFormData] = useState<Partial<TravelEvent>>({
    type: 'activity',
    isCashOnly: false,
    startTime: toLocalISOString(new Date()),
    cost: 0,
    currency: 'EUR'
  });

  // Initial Load
  useEffect(() => {
    const savedEvents = localStorage.getItem('euro_travel_events');
    const savedRates = localStorage.getItem('euro_travel_rates');
    
    if (savedEvents) {
      try {
        setEvents(JSON.parse(savedEvents));
      } catch (e) { console.error("Failed to parse events", e); }
    }
    
    if (savedRates) {
      try {
        const parsed = JSON.parse(savedRates);
        setExchangeRates(prev => ({ ...prev, ...parsed }));
      } catch (e) { console.error("Failed to parse rates", e); }
    }
  }, []);

  // Performance Stability: Debounce saving to localStorage
  // Waits 800ms after last change before writing to disk
  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem('euro_travel_events', JSON.stringify(events));
      localStorage.setItem('euro_travel_rates', JSON.stringify(exchangeRates));
    }, 800);

    return () => clearTimeout(handler);
  }, [events, exchangeRates]);

  // --- Helpers ---

  const showAlert = useCallback((title: string, message: string) => {
    setModalConfig({ isOpen: true, title, message, type: 'alert' });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, title, message, type: 'confirm', onConfirm });
  }, []);

  // --- Backup & Restore Logic ---

  const handleExportBackup = () => {
    const backup: BackupData = {
      app: 'euro-travel-pocket',
      version: 1,
      timestamp: new Date().toISOString(),
      events: events,
      rates: exchangeRates
    };

    const dataStr = JSON.stringify(backup, null, 2);
    // Changed MIME type to text/plain for easier mobile access
    const blob = new Blob([dataStr], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Create temporary link to trigger download
    const link = document.createElement('a');
    link.href = url;
    // Changed extension to .txt to open in standard text editors/browsers
    link.download = `travel_backup_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showAlert("Backup Saved", "Your backup file has been downloaded. Keep it safe!");
  };

  const handleRestoreBackup = (jsonString: string) => {
    try {
      let backup: any;
      try {
        backup = JSON.parse(jsonString);
      } catch (jsonError) {
        // Fallback for JS Object notation (unquoted keys)
        try {
          // eslint-disable-next-line no-new-func
          backup = new Function(`return ${jsonString}`)();
        } catch {
          throw jsonError; // Throw original error if fallback fails
        }
      }
      
      // Robust Validation & Normalization
      if (!backup || typeof backup !== 'object') {
         throw new Error("Invalid data format: Not an object");
      }

      // Handle raw array paste (user pasted just the events list)
      if (Array.isArray(backup)) {
         backup = { events: backup };
      }

      // Validate events array
      if (!Array.isArray(backup.events)) {
        throw new Error("Invalid backup: 'events' list missing or incorrect.");
      }

      // (Optional) Check app signature - Log warning instead of failing
      if (backup.app && backup.app !== 'euro-travel-pocket') {
         console.warn("Restoring data from potentially different app source.");
      }

      setEvents(backup.events);
      if (backup.rates) {
        setExchangeRates(backup.rates);
      }
      
      showAlert("Success", "Data successfully restored!");
    } catch (e: any) {
      console.error(e);
      showAlert("Restore Failed", e.message || "Invalid backup file.");
    }
  };

  const sortedEvents = [...events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const getDisplayEvents = () => {
    // If showing all, show in chronological order (Ascending)
    if (showAllEvents) {
      return sortedEvents;
    }

    // Strict "Today" logic - Ascending (Chronological)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return sortedEvents.filter(e => {
      const eDate = new Date(e.startTime);
      eDate.setHours(0, 0, 0, 0);
      return eDate.getTime() === today.getTime();
    });
  };

  const displayedEvents = getDisplayEvents();
  const isFiltered = !showAllEvents;

  const getExpenseSummary = (): ExpenseSummary => {
    let totalHkd = 0;
    const details: { [key: string]: number } = {};

    events.forEach(e => {
      if (!e.cost) return;
      const rate = exchangeRates[e.currency] || 1.0;
      totalHkd += e.cost * rate;
      details[e.currency] = (details[e.currency] || 0) + e.cost;
    });

    return { totalHkd, details };
  };

  const addToCalendar = (event: TravelEvent) => {
    const formatICSDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    const start = formatICSDate(event.startTime);
    const end = event.endTime ? formatICSDate(event.endTime) : 
                formatICSDate(new Date(new Date(event.startTime).getTime() + 60*60*1000).toISOString());

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${event.title}`,
      `LOCATION:${event.location}`,
      `DESCRIPTION:${event.notes || ''} \n\nGenerated by EuroTravel Pocket`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Gemini & Image Functions ---

  const handleSmartPaste = async (text: string) => {
    const prompt = `
      Extract travel event details from text into JSON.
      Text: "${text}"
      
      Required JSON format:
      {
        "title": "string",
        "location": "string",
        "startTime": "ISO datetime yyyy-MM-ddThh:mm (guess year ${new Date().getFullYear()})",
        "endTime": "ISO datetime (optional)",
        "type": "activity|transport|dining|lodging",
        "cost": number (value only),
        "currency": "ISO currency code (e.g. EUR, USD, JPY) based on location/symbol",
        "seatInfo": "string (optional)",
        "platform": "string (optional)",
        "transportMode": "train|bus|flight (optional)"
      }
      Return ONLY raw JSON.
    `;
    
    const result = await callGemini(prompt);
    try {
      const parsed = parseGeminiResponse(result);
      
      setFormData(prev => ({
        ...prev,
        ...parsed,
        startTime: parsed.startTime && !isNaN(Date.parse(parsed.startTime)) ? parsed.startTime : prev.startTime,
        currency: parsed.currency || prev.currency,
        isCashOnly: false
      }));

      // If a new currency is found, ensure it's in the rates map
      if (parsed.currency && !exchangeRates[parsed.currency]) {
         setExchangeRates(prev => ({ ...prev, [parsed.currency]: 1.0 }));
      }

    } catch (e) {
      console.error(e);
      showAlert("Error", "Could not understand the text. Please try again.");
    }
  };

  const estimateCost = async () => {
    if (!formData.title && !formData.location) return showAlert("Missing Info", "Please enter a Title or Location first.");
    setIsEstimatingCost(true);
    const prompt = `Estimate cost for 1 person: "${formData.title}" at "${formData.location}". 
    Return JSON: { "cost": number, "currency": "ISO code (e.g. EUR, GBP, JPY)" }. 
    If free return 0 cost. Guess the local currency based on location.`;
    
    try {
      const result = await callGemini(prompt);
      const parsed = parseGeminiResponse(result);
      
      if (typeof parsed.cost === 'number') {
        setFormData(prev => ({ 
          ...prev, 
          cost: parsed.cost, 
          currency: parsed.currency || prev.currency 
        }));
        
        if (parsed.currency && !exchangeRates[parsed.currency]) {
          setExchangeRates(prev => ({ ...prev, [parsed.currency]: 1.0 }));
        }
      }
    } catch(e) {
      console.error(e);
      showAlert("Error", "Could not estimate cost.");
    }
    setIsEstimatingCost(false);
  };

  const enhanceEvent = async (event: TravelEvent) => {
    setEnhancingEventId(event.id);
    const prompt = `
      Analyze location: "${event.location}" and title: "${event.title}".
      Return JSON:
      {
        "mustDo": ["short phrase 1", "short phrase 2"],
        "warnings": ["short warning 1"],
        "wikiSearchTerm": "Wikipedia exact title for image search"
      }
    `;

    try {
      const gResult = await callGemini(prompt);
      const info = parseGeminiResponse(gResult);
      const imageUrl = await fetchWikiImage(info.wikiSearchTerm || event.title);

      setEvents(prev => prev.map(e => {
        if (e.id === event.id) {
          return {
            ...e,
            mustDos: info.mustDo,
            warnings: info.warnings,
            imageUrl: imageUrl
          };
        }
        return e;
      }));
    } catch (e) {
      console.error("Enhance failed", e);
      showAlert("Error", "Couldn't fetch guide details.");
    }
    setEnhancingEventId(null);
  };

  const generateSuggestions = async () => {
    if (!suggestionParams.location) return showAlert("Missing Info", "Please enter a location.");
    
    const start = new Date(suggestionParams.startDate);
    const end = new Date(suggestionParams.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 

    if (diffDays > 14) return showAlert("Trip too long", "Please limit planning to 14 days or less.");

    setIsGeneratingSuggestions(true);
    const existingTitles = events.map(e => `${e.title} (${e.location})`).join(', ');

    const prompt = `
      Plan ${diffDays}-day trip to ${suggestionParams.location}.
      Start: ${suggestionParams.startDate}. End: ${suggestionParams.endDate}.
      Prefs: "${suggestionParams.preferences}".
      Exclude: [${existingTitles}].
      
      Return JSON array of objects:
      {
        "title": "string",
        "location": "string",
        "startTime": "HH:mm",
        "dayOffset": int (0 based),
        "type": "activity|dining",
        "cost": number,
        "currency": "ISO code",
        "notes": "string",
        "reason": "string"
      }
    `;

    try {
       const result = await callGemini(prompt);
       const suggestions: Suggestion[] = parseGeminiResponse(result);
       setGeneratedSuggestions(suggestions);
    } catch (e) {
       console.error(e);
       showAlert("Error", "Failed to generate plan.");
    }
    setIsGeneratingSuggestions(false);
  };

  const addSuggestionToItinerary = (suggestion: Suggestion) => {
     const baseDate = new Date(suggestionParams.startDate);
     baseDate.setDate(baseDate.getDate() + (suggestion.dayOffset || 0));
     const dateStr = baseDate.toISOString().slice(0, 10);
     const isoStart = `${dateStr}T${suggestion.startTime}`;
     
     const newEvent: TravelEvent = {
        id: crypto.randomUUID(),
        title: suggestion.title,
        location: suggestion.location,
        startTime: isoStart,
        endTime: '', 
        type: suggestion.type,
        cost: suggestion.cost,
        currency: suggestion.currency || 'EUR',
        notes: suggestion.notes,
        isCashOnly: false
     };
     setEvents([...events, newEvent]);
     
     // Ensure currency exists
     if (newEvent.currency && !exchangeRates[newEvent.currency]) {
        setExchangeRates(prev => ({ ...prev, [newEvent.currency]: 1.0 }));
     }
     
     showAlert("Success", `Added "${suggestion.title}"!`);
  };

  // --- Handlers ---

  const handleEditEvent = (event: TravelEvent) => {
    setFormData({ ...event });
    setView('add');
  };

  const handleAddEvent = () => {
    if (!formData.title || !formData.startTime) {
      showAlert("Missing Info", "Title and Start Time are required.");
      return;
    }
    
    const currency = formData.currency?.toUpperCase() || 'EUR';
    
    const eventData = {
      title: formData.title || 'Untitled',
      location: formData.location || '',
      startTime: formData.startTime || '',
      endTime: formData.endTime || '',
      type: formData.type as EventType,
      notes: formData.notes || '',
      isCashOnly: formData.isCashOnly || false,
      cost: Number(formData.cost) || 0,
      currency: currency,
      seatInfo: formData.seatInfo,
      platform: formData.platform,
      transferInfo: formData.transferInfo,
      ticketFileRef: formData.ticketFileRef,
      transportMode: formData.transportMode as any,
      imageUrl: formData.imageUrl,
      mustDos: formData.mustDos,
      warnings: formData.warnings,
    };

    if (formData.id) {
       setEvents(events.map(e => e.id === formData.id ? { ...e, ...eventData, id: formData.id } : e));
    } else {
       setEvents([...events, { ...eventData, id: crypto.randomUUID() }]);
    }
    
    if (!exchangeRates[currency]) {
       setExchangeRates(prev => ({ ...prev, [currency]: 1.0 }));
    }

    setFormData({
      type: 'activity',
      isCashOnly: false,
      startTime: toLocalISOString(new Date()),
      cost: 0,
      currency: 'EUR'
    });
    setView('itinerary');
  };

  const deleteEvent = (id: string) => {
    showConfirm("Delete Event?", "This action cannot be undone.", () => {
      setEvents(prev => prev.filter(e => e.id !== id));
    });
  };

  const toggleDateCollapse = (dateKey: string) => {
    const newSet = new Set(collapsedDates);
    if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
    } else {
        newSet.add(dateKey);
    }
    setCollapsedDates(newSet);
  };

  // --- Views ---

  // Converted to Render Functions to prevent unmounting/keyboard focus loss issues
  const renderItineraryView = () => {
    // Group events by date for the collapsible logic
    const groups: { date: string; events: TravelEvent[] }[] = [];
    displayedEvents.forEach(event => {
        const dateStr = new Date(event.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        
        if (groups.length === 0 || groups[groups.length - 1].date !== dateStr) {
            groups.push({ date: dateStr, events: [event] });
        } else {
            groups[groups.length - 1].events.push(event);
        }
    });

    return (
      <div className="pb-32">
        <div className="pt-12 pb-2 px-5 bg-[#F2F2F7]">
          <div className="flex justify-between items-end">
            <div>
               <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">Itinerary</h1>
               {isFiltered && <div className="text-[#007AFF] text-sm font-semibold">Today's Plan</div>}
            </div>
            <div className="text-right pb-1">
               <button 
                 onClick={() => setShowAllEvents(!showAllEvents)}
                 className="text-[13px] font-semibold text-[#007AFF] mb-1 flex items-center gap-1 justify-end"
               >
                  {showAllEvents ? <Filter className="w-3 h-3" /> : <List className="w-3 h-3" />}
                  {showAllEvents ? 'Show Today' : 'Show All'}
               </button>
               <div className="text-[17px] font-bold text-[#8E8E93]">
                 Total <span className="text-[#007AFF]">HK${getExpenseSummary().totalHkd.toFixed(0)}</span>
               </div>
            </div>
          </div>
        </div>
  
        {displayedEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[50vh] text-[#8E8E93] px-10 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
              <Plus className="w-8 h-8 text-[#007AFF]" />
            </div>
            <h3 className="text-lg font-semibold text-black mb-1">
              {showAllEvents ? "No Events Yet" : "No Plans Today"}
            </h3>
            <p className="text-sm">
              {showAllEvents ? "Tap the + button to start." : "Relax! Or check 'Show All' to see future trips."}
            </p>
          </div>
        )}
  
        <div className="space-y-2 px-4">
          {groups.map((group) => {
            const isCollapsed = collapsedDates.has(group.date);
            
            return (
              <div key={group.date} className="mb-6">
                 {/* Collapsible Header */}
                 <div 
                    onClick={() => toggleDateCollapse(group.date)}
                    className="sticky top-0 z-10 pt-4 pb-2 -mx-4 px-8 bg-[#F2F2F7]/95 backdrop-blur-md flex items-center justify-between cursor-pointer active:opacity-70 transition-opacity"
                 >
                    <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide">
                        {group.date}
                    </h2>
                    {isCollapsed ? <ChevronDown className="w-4 h-4 text-[#8E8E93]" /> : <ChevronUp className="w-4 h-4 text-[#8E8E93]" />}
                 </div>

                 {/* Events List (Conditionally Rendered) */}
                 {!isCollapsed && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                      {group.events.map((event) => {
                        // Find global index for prevEvent logic if needed, 
                        // though simplified routing logic (just current location) is used here.
                        const dateObj = new Date(event.startTime);
                        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        let durationStr = timeStr;
                        if (event.endTime) {
                          const endObj = new Date(event.endTime);
                          durationStr = `${timeStr} - ${endObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                        }
                        const isEnhancing = enhancingEventId === event.id;
                        
                        // Find previous event globally to support "Route from X"
                        const globalIndex = events.findIndex(e => e.id === event.id); // Simple find, adequate for small lists
                        // Note: Sorting affects this. We need the sorted list.
                        const sortedList = sortedEvents; 
                        const sortedIndex = sortedList.findIndex(e => e.id === event.id);
                        const prevEvent = sortedIndex > 0 ? sortedList[sortedIndex - 1] : null;

                        return (
                          <div key={event.id} className="relative pl-4">
                            <div className="absolute left-0 top-3 bottom-0 w-[2px] bg-[#E5E5EA] rounded-full"></div>
                            <div className={`absolute left-[-5px] top-3 w-3 h-3 rounded-full border-2 border-[#F2F2F7] z-10 ${
                              event.type === 'transport' ? 'bg-orange-500' : 
                              event.type === 'dining' ? 'bg-green-500' : 'bg-[#007AFF]'
                            }`}></div>
            
                            {prevEvent && (
                              <div className="mb-3">
                                <button 
                                  onClick={() => {
                                      const origin = prevEvent.location ? `&origin=${encodeURIComponent(prevEvent.location)}` : '';
                                      const dest = `&destination=${encodeURIComponent(event.location)}`;
                                      window.open(`https://www.google.com/maps/dir/?api=1${origin}${dest}&travelmode=transit`, '_blank');
                                  }}
                                  className="flex items-center gap-2 text-[13px] font-medium text-[#007AFF] bg-blue-50/50 px-3 py-1.5 rounded-full w-fit hover:bg-blue-100 transition-colors"
                                >
                                    <Navigation className="w-3.5 h-3.5" />
                                    <span>Route to here</span>
                                </button>
                              </div>
                            )}
            
                            <IOSCard className="mb-2">
                              {event.imageUrl && (
                                <div className="h-32 w-full relative">
                                    <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                </div>
                              )}
            
                              <div className="p-4">
                                <div className="flex justify-between items-start mb-1">
                                  <div className="flex flex-col">
                                    <span className="text-[13px] font-medium text-[#8E8E93]">{durationStr}</span>
                                    <h3 className="text-[17px] font-semibold text-black leading-tight">{event.title}</h3>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    {event.isCashOnly && (
                                      <span className="bg-[#FF3B30]/10 text-[#FF3B30] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 mt-1">
                                        CASH
                                      </span>
                                    )}
                                    <button 
                                      onClick={() => addToCalendar(event)}
                                      className="text-[#007AFF] bg-blue-50 p-1.5 rounded-full hover:bg-blue-100 active:scale-95 transition-all"
                                      title="Add to Calendar"
                                    >
                                      <Calendar className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
            
                                {event.location && (
                                  <div className="flex items-center gap-1.5 text-[#8E8E93] text-[13px] mb-3">
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span className="truncate">{event.location}</span>
                                  </div>
                                )}
            
                                {(event.mustDos || event.warnings) ? (
                                  <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100">
                                    {event.mustDos && event.mustDos.length > 0 && (
                                      <div className="mb-2">
                                        <h4 className="flex items-center gap-1 text-[11px] font-bold uppercase text-purple-600 mb-1">
                                          <CheckCircle2 className="w-3 h-3" /> Highlights
                                        </h4>
                                        <ul className="list-disc list-inside text-[13px] text-slate-700 space-y-0.5">
                                          {event.mustDos.map((item, i) => <li key={i}>{item}</li>)}
                                        </ul>
                                      </div>
                                    )}
                                    {event.warnings && event.warnings.length > 0 && (
                                      <div>
                                        <h4 className="flex items-center gap-1 text-[11px] font-bold uppercase text-red-600 mb-1">
                                          <AlertTriangle className="w-3 h-3" /> Watch Out
                                        </h4>
                                        <ul className="list-disc list-inside text-[13px] text-slate-700 space-y-0.5">
                                          {event.warnings.map((item, i) => <li key={i}>{item}</li>)}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  event.type === 'activity' && event.location && (
                                    <button 
                                      onClick={() => enhanceEvent(event)}
                                      disabled={isEnhancing}
                                      className="w-full mb-3 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors border border-purple-100"
                                    >
                                      {isEnhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                      Load Photos & Tourist Guide
                                    </button>
                                  )
                                )}
            
                                {event.type === 'transport' && (
                                  <div className="bg-[#F2F2F7] rounded-xl p-3 mb-3">
                                    <div className="flex items-center gap-2 mb-2 text-orange-600 font-semibold text-[13px]">
                                        {event.transportMode === 'flight' ? <Plane className="w-4 h-4"/> : 
                                        event.transportMode === 'bus' ? <Bus className="w-4 h-4"/> : 
                                        <Train className="w-4 h-4"/>}
                                        <span>Transport Details</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        {event.seatInfo && (
                                          <div className="bg-white px-2 py-1 rounded-lg text-center shadow-sm">
                                            <div className="text-[10px] text-[#8E8E93] uppercase font-bold">Seat</div>
                                            <div className="text-[13px] font-semibold font-mono">{event.seatInfo}</div>
                                          </div>
                                        )}
                                        {event.platform && (
                                          <div className="bg-white px-2 py-1 rounded-lg text-center shadow-sm">
                                            <div className="text-[10px] text-[#8E8E93] uppercase font-bold">Platform</div>
                                            <div className="text-[13px] font-semibold font-mono">{event.platform}</div>
                                          </div>
                                        )}
                                    </div>
                                    {event.ticketFileRef && (
                                      <div className="flex items-center gap-2 text-[12px] text-orange-700 bg-orange-100/50 px-2 py-1.5 rounded-lg">
                                          <FileText className="w-3.5 h-3.5" />
                                          <span className="font-medium truncate">{event.ticketFileRef}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {event.cost > 0 && (
                                  <div className="flex items-center justify-end gap-1 mb-3 text-[14px] font-medium text-black">
                                    <span>{event.cost.toFixed(2)}</span>
                                    <span className="text-[11px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{event.currency}</span>
                                  </div>
                                )}
            
                                <div className="flex gap-2 mt-2 pt-2 border-t border-[#F2F2F7]">
                                  {event.location && (
                                    <>
                                      <button onClick={() => window.open(`http://maps.apple.com/?q=${encodeURIComponent(event.location)}`, '_blank')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-medium text-black bg-[#E5E5EA] active:bg-[#D1D1D6]">
                                        <MapPin className="w-4 h-4" /> Apple
                                      </button>
                                      <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`, '_blank')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-medium text-[#007AFF] bg-blue-50 active:bg-blue-100">
                                        <Navigation className="w-4 h-4" /> Google
                                      </button>
                                    </>
                                  )}
                                  
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditEvent(event);
                                    }} 
                                    className="p-2 rounded-lg text-[#007AFF] bg-[#F2F2F7] active:bg-[#E5E5EA]"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
            
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteEvent(event.id);
                                    }} 
                                    className="p-2 rounded-lg text-[#FF3B30] bg-[#F2F2F7] active:bg-[#E5E5EA]"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {event.type !== 'transport' && (
                                      <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=restaurants+near+${encodeURIComponent(event.location)}`, '_blank')} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium text-[#8E8E93] bg-[#F2F2F7] active:bg-[#E5E5EA]">
                                        <Utensils className="w-3 h-3" /> Food
                                      </button>
                                    )}
                                </div>
                              </div>
                            </IOSCard>
                          </div>
                        );
                      })}
                    </div>
                 )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSuggestionsView = () => (
    <div className="pb-32 bg-[#F2F2F7] min-h-screen">
       <div className="pt-12 pb-6 px-5">
         <h1 className="text-[34px] font-bold tracking-tight text-black">Guide</h1>
         <p className="text-[#8E8E93] text-[15px] mt-1">Ask Gemini to plan your day.</p>
       </div>

       <div className="px-4 space-y-6">
          <div className="bg-white rounded-xl overflow-hidden border border-[#E5E5EA]">
            <IOSInput 
              label="Location" 
              placeholder="e.g. Florence, Italy"
              value={suggestionParams.location} 
              onChange={(e: any) => setSuggestionParams({...suggestionParams, location: e.target.value})} 
            />
            <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-[#E5E5EA]">
              <label className="text-[15px] font-medium text-black">Start Date</label>
              <input 
                type="date"
                className="text-right text-[15px] text-[#8E8E93] bg-transparent outline-none"
                value={suggestionParams.startDate}
                onChange={e => setSuggestionParams({...suggestionParams, startDate: e.target.value})}
              />
            </div>
             <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-[#E5E5EA]">
              <label className="text-[15px] font-medium text-black">End Date</label>
              <input 
                type="date"
                className="text-right text-[15px] text-[#8E8E93] bg-transparent outline-none"
                value={suggestionParams.endDate}
                onChange={e => setSuggestionParams({...suggestionParams, endDate: e.target.value})}
              />
            </div>

            <div className="bg-white px-4 py-3 border-b border-[#E5E5EA]">
               <label className="text-[15px] font-medium text-black block mb-2">Preferences</label>
               <textarea 
                 className="w-full bg-[#F2F2F7] rounded-lg p-3 text-[15px] min-h-[80px] outline-none"
                 placeholder="e.g. I love art museums and cheap street food. No hiking please."
                 value={suggestionParams.preferences}
                 onChange={e => setSuggestionParams({...suggestionParams, preferences: e.target.value})}
               />
            </div>

            <div className="p-4">
              <IOSButton 
                 variant="magic" 
                 onClick={generateSuggestions} 
                 disabled={isGeneratingSuggestions}
                 className="w-full"
              >
                 {isGeneratingSuggestions ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Generate Plan</>}
              </IOSButton>
            </div>
          </div>

          {generatedSuggestions.length > 0 && (
             <div className="space-y-4 animate-in slide-in-from-bottom-4 fade-in">
               <div className="pl-2 text-[13px] font-semibold text-[#8E8E93] uppercase">Suggested Itinerary</div>
               {generatedSuggestions.map((item, i) => {
                 const baseDate = new Date(suggestionParams.startDate);
                 baseDate.setDate(baseDate.getDate() + (item.dayOffset || 0));
                 const dayLabel = `Day ${item.dayOffset + 1} - ${baseDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;
                 const showDayHeader = i === 0 || generatedSuggestions[i-1].dayOffset !== item.dayOffset;

                 return (
                  <React.Fragment key={i}>
                    {showDayHeader && (
                      <div className="sticky top-0 z-10 pt-2 pb-1 bg-[#F2F2F7]/95 backdrop-blur-md">
                        <h2 className="text-[12px] font-bold text-[#007AFF] uppercase tracking-wide">{dayLabel}</h2>
                      </div>
                    )}
                    <IOSCard>
                      <div className="p-4 flex items-start gap-3">
                          <div className="flex flex-col items-center mt-1">
                            <div className="text-[12px] font-bold text-[#8E8E93]">{item.startTime}</div>
                            <div className={`w-2 h-2 rounded-full mt-1 ${item.type === 'dining' ? 'bg-green-500' : 'bg-blue-500'}`} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-black">{item.title}</h4>
                            <div className="text-[13px] text-[#8E8E93] mb-1">{item.location}</div>
                            <div className="bg-slate-50 p-2 rounded-lg text-[12px] text-slate-700 mb-2">
                                {item.notes}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-[12px] font-medium text-black">
                                   {item.cost > 0 ? `${item.cost} ${item.currency || 'EUR'}` : 'Free'}
                                </span>
                                <button 
                                  onClick={() => addSuggestionToItinerary(item)}
                                  className="bg-[#E5E5EA] text-[#007AFF] px-3 py-1.5 rounded-full text-[12px] font-bold flex items-center gap-1 active:scale-95 transition-transform"
                                >
                                  <Plus className="w-3 h-3" /> Add
                                </button>
                            </div>
                          </div>
                      </div>
                    </IOSCard>
                  </React.Fragment>
                 );
               })}
             </div>
          )}
       </div>
    </div>
  );

  const renderAddEventView = () => (
    <div className="bg-[#F2F2F7] min-h-full pb-32 pt-6">
      <div className="flex items-center justify-between px-4 mb-6">
        <button onClick={() => setView('itinerary')} className="text-[#007AFF] text-[17px]">Cancel</button>
        <h2 className="text-[17px] font-semibold">{formData.id ? 'Edit Event' : 'New Event'}</h2>
        <button onClick={handleAddEvent} className="text-[#007AFF] text-[17px] font-semibold">Done</button>
      </div>

      <div className="px-4 mb-4">
        {!formData.id && (
          <IOSButton 
            variant="magic" 
            onClick={() => setIsSmartPasteOpen(true)}
            className="w-full text-sm py-2 mb-4"
          >
            <Sparkles className="w-4 h-4" />
            Auto-Fill from Text/Clipboard
          </IOSButton>
        )}

        <IOSSegmentedControl 
           options={[
             {label: 'Activity', value: 'activity'},
             {label: 'Transport', value: 'transport'},
             {label: 'Dining', value: 'dining'},
             {label: 'Stay', value: 'lodging'}
           ]}
           selected={formData.type}
           onChange={(v: any) => setFormData({...formData, type: v as EventType})}
        />
      </div>

      <div className="px-4 space-y-6">
        <div className="space-y-1">
          <div className="pl-4 text-[13px] text-[#8E8E93] uppercase mb-1">General</div>
          <div className="bg-white rounded-xl overflow-hidden border border-[#E5E5EA]">
            <IOSInput 
              label="Title" 
              placeholder="Louvre Museum"
              value={formData.title} 
              onChange={(e: any) => setFormData({...formData, title: e.target.value})} 
            />
            <IOSInput 
              label="Location" 
              placeholder="Address / Place"
              value={formData.location} 
              onChange={(e: any) => setFormData({...formData, location: e.target.value})} 
            />
             <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-[#E5E5EA]">
              <label className="text-[15px] font-medium text-black">Start Time</label>
              <input 
                type="datetime-local"
                className="text-right text-[15px] text-[#8E8E93] bg-transparent outline-none"
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
              />
            </div>
             <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-[#E5E5EA]">
              <label className="text-[15px] font-medium text-black">End Time</label>
              <input 
                type="datetime-local"
                className="text-right text-[15px] text-[#8E8E93] bg-transparent outline-none"
                value={formData.endTime || ''}
                onChange={e => setFormData({...formData, endTime: e.target.value})}
              />
            </div>
            
            <IOSInput 
              label="Cost" 
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.cost} 
              onChange={(e: any) => setFormData({...formData, cost: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
              rightElement={
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="EUR"
                    maxLength={3}
                    className="w-12 text-center text-[15px] font-bold text-slate-600 bg-slate-100 rounded px-1 py-1 uppercase"
                    value={formData.currency}
                    onChange={(e) => setFormData({...formData, currency: e.target.value.toUpperCase()})}
                  />
                  <button 
                    onClick={estimateCost} 
                    disabled={isEstimatingCost}
                    className="ml-1 p-1.5 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg text-white shadow-sm disabled:opacity-50"
                    title="Estimate Cost with Gemini"
                  >
                    {isEstimatingCost ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  </button>
                </div>
              }
            />
          </div>
        </div>

        {formData.type === 'transport' && (
          <div className="space-y-1 animate-in slide-in-from-bottom-2 fade-in">
            <div className="pl-4 text-[13px] text-[#8E8E93] uppercase mb-1">Transport Details</div>
            <div className="bg-white rounded-xl overflow-hidden border border-[#E5E5EA]">
              <div className="p-3 bg-white border-b border-[#E5E5EA]">
                 <IOSSegmentedControl 
                   options={[
                     {label: 'Train', value: 'train'},
                     {label: 'Bus', value: 'bus'},
                     {label: 'Flight', value: 'flight'}
                   ]}
                   selected={formData.transportMode || 'train'}
                   onChange={(v: any) => setFormData({...formData, transportMode: v as any})}
                />
              </div>
              <IOSInput 
                label="Seat Info" 
                placeholder="Car 4, Seat 22A"
                value={formData.seatInfo} 
                onChange={(e: any) => setFormData({...formData, seatInfo: e.target.value})} 
              />
              <IOSInput 
                label="Platform" 
                placeholder="Track 9"
                value={formData.platform} 
                onChange={(e: any) => setFormData({...formData, platform: e.target.value})} 
              />
              <IOSInput 
                label="Ticket Ref" 
                placeholder="PDF Link or Number"
                value={formData.ticketFileRef} 
                onChange={(e: any) => setFormData({...formData, ticketFileRef: e.target.value})} 
              />
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl px-4 py-3 border border-[#E5E5EA] flex items-center justify-between">
          <span className="text-[15px] font-medium text-black">Cash Only?</span>
          <div 
             onClick={() => setFormData({...formData, isCashOnly: !formData.isCashOnly})}
             className={`w-[51px] h-[31px] rounded-full p-[2px] cursor-pointer transition-colors duration-200 ${formData.isCashOnly ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'}`}
          >
             <div className={`w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200 ${formData.isCashOnly ? 'translate-x-[20px]' : 'translate-x-0'}`} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderExpensesView = () => {
    const summary = getExpenseSummary();
    const usedCurrencies = Object.keys(summary.details);

    return (
      <div className="bg-[#F2F2F7] min-h-full pb-32">
        <div className="pt-12 pb-6 px-5">
          <h1 className="text-[34px] font-bold tracking-tight text-black">Wallet</h1>
        </div>

        <div className="px-4 space-y-6">
          <div className="bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e] rounded-2xl p-6 text-white shadow-xl">
             <div className="flex justify-between items-start mb-8">
                <div className="text-[13px] font-medium opacity-70 uppercase tracking-wider">Total Est. Spending</div>
                <Coins className="w-6 h-6 opacity-50" />
             </div>
             <div>
                <div className="text-[38px] font-bold tracking-tight mb-1">
                   HK${summary.totalHkd.toFixed(0)}
                </div>
                <div className="text-[13px] opacity-60 font-medium">
                   Base Currency: HKD
                </div>
             </div>
          </div>

           <div className="space-y-1">
             <div className="pl-4 text-[13px] text-[#8E8E93] uppercase mb-1">Data Backup</div>
             <div className="bg-white rounded-xl p-3 border border-[#E5E5EA] flex gap-3">
               <button 
                 onClick={handleExportBackup}
                 className="flex-1 flex flex-col items-center justify-center gap-2 py-3 rounded-lg bg-[#F2F2F7] active:bg-[#E5E5EA] text-[#007AFF]"
               >
                 <Download className="w-5 h-5" />
                 <span className="text-[13px] font-semibold">Save Backup</span>
               </button>
               <button 
                 onClick={() => setIsRestoreOpen(true)}
                 className="flex-1 flex flex-col items-center justify-center gap-2 py-3 rounded-lg bg-[#F2F2F7] active:bg-[#E5E5EA] text-[#FF3B30]"
               >
                 <Upload className="w-5 h-5" />
                 <span className="text-[13px] font-semibold">Restore Data</span>
               </button>
             </div>
             <p className="px-4 text-[12px] text-[#8E8E93] mt-2">
               Download a file to keep your data safe, or paste a backup file to restore lost trips.
             </p>
          </div>

          <div className="space-y-1">
             <div className="pl-4 text-[13px] text-[#8E8E93] uppercase mb-1">Exchange Rates (to HKD)</div>
             <div className="bg-white rounded-xl overflow-hidden border border-[#E5E5EA]">
                {usedCurrencies.length === 0 && (
                  <div className="p-4 text-center text-[#8E8E93] text-[15px]">No currencies used yet.</div>
                )}
                {usedCurrencies.map(currency => (
                  <IOSInput 
                    key={currency}
                    label={`1 ${currency} =`}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={exchangeRates[currency]}
                    onChange={(e: any) => setExchangeRates(prev => ({ 
                      ...prev, 
                      [currency]: e.target.value === '' ? 0 : parseFloat(e.target.value) 
                    }))}
                    rightElement={<span className="text-[15px] text-[#8E8E93] ml-2">HKD</span>}
                  />
                ))}
             </div>
          </div>

          <div className="space-y-1">
             <div className="pl-4 text-[13px] text-[#8E8E93] uppercase mb-1">Transactions</div>
             <div className="bg-white rounded-xl overflow-hidden border border-[#E5E5EA]">
                {events.filter(e => e.cost > 0).map((e) => (
                  <div key={e.id} className="flex justify-between items-center p-4 border-b border-[#E5E5EA] last:border-0">
                     <div className="flex flex-col">
                        <span className="text-[15px] font-medium text-black">{e.title}</span>
                        <span className="text-[13px] text-[#8E8E93]">{new Date(e.startTime).toLocaleDateString()}</span>
                     </div>
                     <div className="text-right">
                        <div className="text-[15px] font-medium text-black">{e.cost.toFixed(2)} {e.currency}</div>
                        <div className="text-[12px] text-[#8E8E93]">
                          HK${(e.cost * (exchangeRates[e.currency] || 1)).toFixed(0)}
                        </div>
                     </div>
                  </div>
                ))}
                {events.filter(e => e.cost > 0).length === 0 && (
                  <div className="p-4 text-center text-[#8E8E93] text-[15px]">No expenses recorded yet.</div>
                )}
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] font-sans text-black max-w-md mx-auto relative shadow-2xl overflow-hidden">
      
      <SmartPasteModal 
        isOpen={isSmartPasteOpen}
        onClose={() => setIsSmartPasteOpen(false)}
        onProcess={handleSmartPaste}
      />

      <RestoreModal 
        isOpen={isRestoreOpen}
        onClose={() => setIsRestoreOpen(false)}
        onRestore={handleRestoreBackup}
      />

      <SystemModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={modalConfig.onConfirm}
      />

      {/* Main Content Area */}
      <div className="h-screen overflow-y-auto no-scrollbar">
        {view === 'itinerary' && renderItineraryView()}
        {view === 'add' && renderAddEventView()}
        {view === 'expenses' && renderExpensesView()}
        {view === 'suggestions' && renderSuggestionsView()}
      </div>

      {/* iOS Tab Bar */}
      {view !== 'add' && (
        <div className="absolute bottom-0 left-0 right-0 h-[83px] bg-white/80 backdrop-blur-md border-t border-[#C6C6C8] flex justify-around items-start pt-3 z-50">
           <button 
             onClick={() => setView('itinerary')}
             className="flex flex-col items-center gap-1 w-16"
           >
             <MapPin className={`w-6 h-6 ${view === 'itinerary' ? 'text-[#007AFF]' : 'text-[#999999]'}`} />
             <span className={`text-[10px] font-medium ${view === 'itinerary' ? 'text-[#007AFF]' : 'text-[#999999]'}`}>Trip</span>
           </button>
           
           <button 
             onClick={() => setView('suggestions')}
             className="flex flex-col items-center gap-1 w-16"
           >
             <Compass className={`w-6 h-6 ${view === 'suggestions' ? 'text-[#007AFF]' : 'text-[#999999]'}`} />
             <span className={`text-[10px] font-medium ${view === 'suggestions' ? 'text-[#007AFF]' : 'text-[#999999]'}`}>Guide</span>
           </button>

           <button 
             onClick={() => {
                setFormData({
                  type: 'activity',
                  isCashOnly: false,
                  startTime: toLocalISOString(new Date()),
                  cost: 0,
                  currency: 'EUR'
                });
                setView('add');
             }}
             className="flex flex-col items-center gap-1 w-16"
           >
             <div className="bg-[#007AFF] rounded-full p-2 mb-[-5px] shadow-lg shadow-blue-200">
               <Plus className="w-6 h-6 text-white" />
             </div>
             <span className="text-[10px] font-medium text-[#007AFF]">New</span>
           </button>

           <button 
             onClick={() => setView('expenses')}
             className="flex flex-col items-center gap-1 w-16"
           >
             <CreditCard className={`w-6 h-6 ${view === 'expenses' ? 'text-[#007AFF]' : 'text-[#999999]'}`} />
             <span className={`text-[10px] font-medium ${view === 'expenses' ? 'text-[#007AFF]' : 'text-[#999999]'}`}>Wallet</span>
           </button>
        </div>
      )}
    </div>
  );
}