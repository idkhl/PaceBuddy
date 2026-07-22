import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  ArrowRight,
  Loader2,
  LogOut,
  Target,
  TrendingUp,
  Calculator,
  Wand2,
  Save,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Info,
  PersonStanding,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { GoogleGenAI } from "@google/genai";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  start_date: string;
  average_speed: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_grade_adjusted_pace?: number;
  best_efforts?: {
    name: string;
    moving_time: number;
    distance: number;
  }[];
}

interface StravaZones {
  heart_rate?: {
    custom_zones: boolean;
    zones: { min: number; max: number }[];
  };
  pace?: {
    custom_zones: boolean;
    zones: { min: number; max: number }[];
  };
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [zones, setZones] = useState<StravaZones | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Structured Goal State
  const [raceDate, setRaceDate] = useState("");
  const [raceLength, setRaceLength] = useState("5k");
  const [timeGoal, setTimeGoal] = useState("");
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  
  // Calculator State
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcRecentDist, setCalcRecentDist] = useState<number>(5);
  const [calcRecentHours, setCalcRecentHours] = useState<number>(0);
  const [calcRecentMinutes, setCalcRecentMinutes] = useState<number>(25);
  const [calcRecentSeconds, setCalcRecentSeconds] = useState<number>(0);
  const [calcTargetDist, setCalcTargetDist] = useState<number>(10);
  
  // Manual Fitness State (when no Strava data)
  const [manualFrequency, setManualFrequency] = useState("0 times a week (Starting from scratch)");
  const [manualDistance, setManualDistance] = useState("");
  const [manualTime, setManualTime] = useState("");
  
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [suggestingTime, setSuggestingTime] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [plan, setPlan] = useState("");
  const [isGoalExpanded, setIsGoalExpanded] = useState(true);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const parsedPlan = useMemo(() => {
    if (!plan) return { overview: "", weekly: "", tips: "", tipsArray: [] as string[] };
    
    const extractSection = (regex: RegExp) => {
      const match = plan.match(regex);
      return match ? match[1].trim() : "";
    };

    const overview = extractSection(/(?:#+\s*Overview\s*[\r\n]+)([\s\S]*?)(?=\n#+\s*(?:Plan|Tips)|$)/i);
    const weekly = extractSection(/(?:#+\s*Plan\s*[\r\n]+)([\s\S]*?)(?=\n#+\s*(?:Overview|Tips)|$)/i);
    const tips = extractSection(/(?:#+\s*Tips\s*[\r\n]+)([\s\S]*?)(?=\n#+\s*(?:Overview|Plan)|$)/i);

    const tipsArray = tips 
      ? tips.split('\n')
          .map(t => t.trim())
          .filter(t => t.startsWith('-') || t.startsWith('*'))
          .map(t => t.replace(/^[-*]\s*/, ''))
      : [];

    if (!overview && !weekly && !tips) {
      return { overview: "", weekly: plan, tips: "", tipsArray: [] }; // Fallback if LLM fails formatting
    }
    return { overview, weekly, tips, tipsArray };
  }, [plan]);

  useEffect(() => {
    checkAuth();

    // Listen for OAuth success message from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        checkAuth();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
      if (data.authenticated) {
        fetchActivities();
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error("Failed to check auth status", err);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/strava/activities");
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities);
        setZones(data.zones);
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error("Failed to fetch activities", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await fetch("/api/auth/url");
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to get auth URL");
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response but got " + contentType + ". The server might not be running correctly.");
      }
      
      const { url } = await response.json();

      const authWindow = window.open(
        url,
        "oauth_popup",
        "width=600,height=700",
      );

      if (!authWindow) {
        alert(
          "Please allow popups for this site to connect your Strava account.",
        );
      }
    } catch (error: any) {
      console.error("OAuth error:", error);
      alert(`Failed to initiate connection with Strava. ${error.message || ""}`);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsAuthenticated(false);
      setActivities([]);
      setZones(null);
      setPlan("");
    } catch (err) {
      console.error("Failed to logout", err);
    }
  };

  const savePlan = async () => {
    if (!plan || !isAuthenticated) return;
    setSavingPlan(true);
    try {
      const title = `${raceLength} Plan - Goal: ${timeGoal}`;
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, plan_text: plan }),
      });
      if (!res.ok) throw new Error("Failed to save plan");
      alert("Plan saved successfully!");
    } catch (err: any) {
      alert(err.message || "Could not save plan");
    } finally {
      setSavingPlan(false);
    }
  };

  const generatePlan = async () => {
    if (!raceDate || !timeGoal.trim()) {
      alert("Please fill in all goal fields first.");
      return;
    }

    setGeneratingPlan(true);
    try {
      // Format activities for the prompt
      const activitiesSummary = activities
        .map((a) => {
          let summary = `- ${format(new Date(a.start_date), "MMM d, yyyy")}: ${a.name} - ${(a.distance / 1000).toFixed(2)}km in ${Math.round(a.moving_time / 60)} mins`;
          if (a.average_heartrate) summary += ` (Avg HR: ${a.average_heartrate} bpm)`;
          if (a.average_grade_adjusted_pace) summary += ` (GAP: ${Math.floor(1000 / a.average_grade_adjusted_pace / 60)}:${String(Math.floor((1000 / a.average_grade_adjusted_pace) % 60)).padStart(2, '0')}/km)`;
          if (a.best_efforts && a.best_efforts.length > 0) {
            const bests = a.best_efforts.map(be => `${be.name}: ${Math.round(be.moving_time / 60)}m ${be.moving_time % 60}s`).join(', ');
            summary += `\n  Best Efforts: ${bests}`;
          }
          return summary;
        })
        .join("\n");

      let zonesSummary = "";
      if (zones) {
        zonesSummary = JSON.stringify(zones, null, 2);
      }

      let fitnessContext = "";
      if (activities.length > 0) {
        fitnessContext = `Here is a summary of their recent running activities from Strava:
${activitiesSummary}

${zonesSummary ? `Here are their training zones from Strava (in JSON format, pace zones may be in seconds per meter or meters per second):\n${zonesSummary}` : ""}`;
      } else {
        fitnessContext = `The user has no recent running data on Strava. Here is their self-reported current fitness:
- Current running frequency: ${manualFrequency}
- Longest recent distance: ${manualDistance ? manualDistance + ' km' : 'Not specified'}
- Time for that distance: ${manualTime || 'Not specified'}

Please use this self-reported data to estimate their current fitness and baseline pace.`;
      }

      const prompt = `
You are an expert running coach for beginners. Your name is PaceBuddy.
Today's date is: ${format(new Date(), "MMM d, yyyy")}.

The user wants a personalized running plan based on the following specific goal parameters:

- Race Date: ${raceDate}
- Race Length: ${raceLength}
- Time Goal: ${timeGoal}
- Sessions per week: ${sessionsPerWeek}

${fitnessContext}

Based on their recent activity level (or self-reported fitness), their goal, and their training zones (if available), create a realistic, safe, and motivating training plan.

CRITICAL REQUIREMENTS FOR THE PLAN:
Format the plan clearly using Markdown, strictly divided into the following three sections:

# Overview
A very concise, punchy analysis (max 3 sentences) of their current fitness and the primary strategy to achieve their goal. No fluff, straight to the point.

# Plan
A week-by-week calendar planning from today until the Race Date (${raceDate}). 
- EXACTLY ${sessionsPerWeek} running sessions per week. Do not schedule more or fewer runs than this.
- Use these specific training session types: Easy runs, Long runs, Interval runs, and Tempo runs.
- You MUST specify the target pace for Interval runs and Tempo runs (use their Strava pace zones or GAP if available, otherwise estimate based on their time goal and current fitness).
- DO NOT USE MARKDOWN TABLES. Use a clear, nested bulleted list format. Example:
   ### Week 1 (Date)
   - **Session 1 (Easy):** 30m @ 8:00/km
   - **Session 2 (Interval):** 6x400m @ 4:50/km (90s rest)
   - **Session 3 (Long):** 6km @ 8:15/km

# Tips
Concise, actionable tips for injury prevention and recovery tailored to their specific goal. 
- You MUST provide these as a simple bulleted list.
- Each tip MUST be exactly one concise sentence.
- Provide between 5 and 8 tips.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      setPlan(response.text || "Failed to generate plan.");
      setIsGoalExpanded(false);
      setIsOverviewExpanded(true);
      setCurrentTipIndex(0);
    } catch (err: any) {
      console.error("Detailed error generating plan:", err);
      const errorMessage = err?.message || "Unknown error";
      alert(`Failed to generate plan: ${errorMessage}. Please try again.`);
    } finally {
      setGeneratingPlan(false);
    }
  };

  const recentTimeSecs = calcRecentHours * 3600 + calcRecentMinutes * 60 + calcRecentSeconds;
  let estimatedTimeSecs = 0;
  let estimatedPaceSecs = 0;
  if (recentTimeSecs > 0 && calcRecentDist > 0 && calcTargetDist > 0) {
    estimatedTimeSecs = recentTimeSecs * Math.pow(calcTargetDist / calcRecentDist, 1.06);
    estimatedPaceSecs = estimatedTimeSecs / calcTargetDist;
  }

  const formatTime = (totalSecs: number) => {
    if (!totalSecs || isNaN(totalSecs)) return "--:--";
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = Math.floor(totalSecs % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const applyCalculatorToGoal = () => {
    let lengthStr = "5k";
    if (calcTargetDist === 10) lengthStr = "10k";
    if (calcTargetDist === 21.0975) lengthStr = "Half Marathon (Semi)";
    if (calcTargetDist === 42.195) lengthStr = "Marathon";
    
    setRaceLength(lengthStr);
    setTimeGoal(formatTime(estimatedTimeSecs));
    setShowCalculator(false);
  };

  const suggestTimeGoal = async () => {
    if (!raceDate || !raceLength || !sessionsPerWeek) {
      alert("Please fill in the Race Date, Race Length, and Sessions Per Week to get a customized time suggestion.");
      return;
    }

    setSuggestingTime(true);
    try {
      const activitiesSummary = activities
        .map((a) => {
          let summary = `- ${format(new Date(a.start_date), "MMM d, yyyy")}: ${a.name} - ${(a.distance / 1000).toFixed(2)}km in ${Math.round(a.moving_time / 60)} mins`;
          if (a.average_heartrate) summary += ` (Avg HR: ${a.average_heartrate} bpm)`;
          return summary;
        })
        .join("\n");

      let fitnessContext = "";
      if (activities.length > 0) {
        fitnessContext = `Recent Strava runs:\n${activitiesSummary}`;
      } else {
        fitnessContext = `Self-reported fitness:\n- Frequency: ${manualFrequency}\n- Longest dist: ${manualDistance ? manualDistance + ' km' : 'Not specified'}\n- Time: ${manualTime || 'Not specified'}`;
      }

      const prompt = `You are an expert running coach.
A runner wants to run a ${raceLength} on ${raceDate}. Today is ${format(new Date(), "MMM d, yyyy")}.
They will train ${sessionsPerWeek} times per week.

Runner's Profile:
${fitnessContext}

Calculate a realistic but challenging target finish time for this ${raceLength} race.
Reply ONLY with the suggested time in MM:SS or HH:MM:SS format (e.g., "45:30" or "01:45:00"). Do not add any extra text, explanation, or markdown formatting.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const suggestedTime = response.text ? response.text.trim() : "";
      if (suggestedTime) {
        setTimeGoal(suggestedTime);
      }
    } catch (err: any) {
      console.error("Failed to suggest time", err);
      alert("Failed to suggest a time. Please enter one manually or try again.");
    } finally {
      setSuggestingTime(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated && !isGuest) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[2rem] border-4 border-foreground shadow-brutal-xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-primary text-white border-4 border-foreground shadow-brutal rounded-2xl flex items-center justify-center mx-auto mb-6 transform -rotate-3">
            <Activity className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-display font-black tracking-tight text-foreground mb-2">PaceBuddy</h1>
          <p className="text-foreground/70 mb-8 font-medium">
            Your AI running coach. Connect your Strava account to get a
            personalized training plan based on your actual running history, or continue as a guest and manually select your fitness level.
          </p>

          

          <button
            onClick={handleConnect}
            className="w-full bg-primary hover:bg-primary-hover hover:-translate-y-1 text-white font-black text-lg py-4 px-4 rounded-xl border-4 border-foreground shadow-brutal hover:shadow-brutal-lg active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 mb-4"
          >
            Connect with Strava
            <ArrowRight className="w-6 h-6 stroke-[3]" />
          </button>
          
          <button
            onClick={() => setIsGuest(true)}
            className="w-full bg-secondary hover:bg-secondary/80 hover:-translate-y-1 text-foreground font-black text-lg py-4 px-4 rounded-xl border-4 border-foreground shadow-brutal hover:shadow-brutal-lg active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
          >
            Continue as Guest
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg selection:bg-primary selection:text-white pb-20">
      <header className="bg-white border-b-4 border-foreground sticky top-0 z-20 shadow-[0_4px_0_0_#080708]">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 text-foreground font-display font-black text-2xl tracking-tighter">
            <div className="bg-primary text-white p-2 rounded-xl border-2 border-foreground transform -rotate-6">
              <Activity className="w-6 h-6 stroke-[3]" />
            </div>
            PaceBuddy
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated && (
              <Link
                to="/saved-plans"
                className="text-foreground hover:text-foreground/80 flex items-center gap-2 text-sm font-bold transition-colors"
                title="View your saved plans"
              >
                <CalendarDays className="w-5 h-5 stroke-[2.5]" />
                Saved Plans
              </Link>
            )}
            <button
              onClick={() => {
                if (isAuthenticated) {
                  handleLogout();
                } else {
                  setIsGuest(false);
                  setPlan("");
                }
              }}
              className="text-foreground/70 hover:text-foreground hover:-translate-y-0.5 bg-white border-2 border-transparent hover:border-foreground hover:shadow-brutal px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all active:translate-y-0 active:shadow-none"
            >
              <LogOut className="w-4 h-4 stroke-[3]" />
              {isAuthenticated ? "Disconnect" : "Exit Guest Mode"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Activities & Goal */}
        <div className="lg:col-span-5 space-y-8">
          {/* Goal Setting */}
          <motion.section 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-3xl border-4 border-foreground shadow-brutal-xl overflow-hidden"
          >
            <button 
              onClick={() => setIsGoalExpanded(!isGoalExpanded)}
              className="w-full p-6 lg:p-8 flex items-center justify-between text-left focus:outline-none focus:bg-foreground/5 transition-colors"
            >
              <div className="flex items-center gap-3 text-foreground">
                <div className="bg-secondary p-2 border-2 border-foreground rounded-lg transform rotate-3">
                  <Target className="w-6 h-6 stroke-[3]" />
                </div>
                <h2 className="font-display font-black text-2xl uppercase tracking-widest">Your Goal</h2>
              </div>
              <div className="text-foreground">
                {isGoalExpanded ? <ChevronUp className="w-6 h-6 stroke-[3]" /> : <ChevronDown className="w-6 h-6 stroke-[3]" />}
              </div>
            </button>
            
            <AnimatePresence>
              {isGoalExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-6 pb-6 lg:px-8 lg:pb-8 border-t-2 border-foreground/10 mb-0"
                >
                  <div className="space-y-5 mb-8 pt-4">
              <div>
                <label className="block text-xs font-black text-foreground mb-2 uppercase tracking-wide">Race Date</label>
                <input
                  type="date"
                  value={raceDate}
                  onChange={(e) => setRaceDate(e.target.value)}
                  className="w-full p-3.5 rounded-xl border-2 border-foreground focus:outline-none focus:ring-0 focus:shadow-primary focus:-translate-y-1 bg-white transition-all text-sm font-bold text-foreground"
                />
              </div>
              
              <div>
                <label className="block text-xs font-black text-foreground mb-2 uppercase tracking-wide">Race Length</label>
                <select
                  value={raceLength}
                  onChange={(e) => setRaceLength(e.target.value)}
                  className="w-full p-3.5 rounded-xl border-2 border-foreground focus:outline-none focus:ring-0 focus:shadow-primary focus:-translate-y-1 bg-white transition-all text-sm font-bold text-foreground"
                >
                  <option value="5k">5k</option>
                  <option value="10k">10k</option>
                  <option value="Half Marathon (Semi)">Half Marathon (Semi)</option>
                  <option value="Marathon">Marathon</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-xs font-black text-foreground uppercase tracking-wide">Time Goal</label>
                  <button
                    onClick={suggestTimeGoal}
                    disabled={suggestingTime || !raceDate || !raceLength || !sessionsPerWeek}
                    className="text-xs font-bold bg-primary hover:bg-primary-hover text-white border-2 border-foreground px-3 py-1.5 rounded-lg shadow-brutal-sm hover:translate-y-px hover:shadow-brutal-xs active:translate-y-1 active:shadow-none transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Suggest a realistic time based on your data and race date"
                  >
                    {suggestingTime ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Wand2 className="w-3.5 h-3.5"/>}
                    Suggest
                  </button>
                </div>
                <input
                  type="text"
                  value={timeGoal}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    let formatted = '';
                    if (digits.length > 0) formatted += digits.substring(0, 2);
                    if (digits.length > 2) formatted += ':' + digits.substring(2, 4);
                    if (digits.length > 4) formatted += ':' + digits.substring(4, 6);
                    setTimeGoal(formatted);
                  }}
                  placeholder="HH:MM:SS (e.g. 00:45:00)"
                  maxLength={8}
                  className="w-full p-3.5 rounded-xl border-2 border-foreground focus:outline-none focus:ring-0 focus:shadow-primary focus:-translate-y-1 bg-white transition-all text-sm font-bold text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-foreground mb-2 uppercase tracking-wide">Sessions Per Week</label>
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={sessionsPerWeek}
                  onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
                  className="w-full p-3.5 rounded-xl border-2 border-foreground focus:outline-none focus:ring-0 focus:shadow-primary focus:-translate-y-1 bg-white transition-all text-sm font-bold text-foreground"
                />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t-2 border-foreground/20 mb-8">
              <button
                onClick={() => setShowCalculator(!showCalculator)}
                className="w-full bg-foreground/10 hover:bg-foreground/20 border-2 border-dashed border-foreground/50 hover:border-foreground font-bold text-foreground/80 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Calculator className="w-5 h-5" />
                {showCalculator ? "Hide Race Pace Calculator" : "Use Pace Calculator"}
              </button>

              {showCalculator && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="mt-4 p-5 bg-secondary/30 rounded-2xl border-2 border-foreground shadow-brutal space-y-4 overflow-hidden"
                >
                  <h3 className="font-display font-black text-foreground text-lg uppercase tracking-wider">Predict Pace</h3>
                  <p className="text-xs font-medium text-foreground/70">Based on Riegel's formula. Compare a recent best effort to your new goal.</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-foreground/90 mb-1">Recent Dist.</label>
                      <select
                        value={calcRecentDist}
                        onChange={(e) => setCalcRecentDist(Number(e.target.value))}
                        className="w-full p-2.5 rounded-lg border-2 border-foreground bg-white font-medium text-sm focus:ring-0"
                      >
                        <option value={5}>5k</option>
                        <option value={10}>10k</option>
                        <option value={21.0975}>Half Marathon</option>
                        <option value={42.195}>Marathon</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-foreground/90 mb-1">Target Dist.</label>
                      <select
                        value={calcTargetDist}
                        onChange={(e) => setCalcTargetDist(Number(e.target.value))}
                        className="w-full p-2.5 rounded-lg border-2 border-foreground bg-white font-medium text-sm focus:ring-0"
                      >
                        <option value={5}>5k</option>
                        <option value={10}>10k</option>
                        <option value={21.0975}>Half Marathon</option>
                        <option value={42.195}>Marathon</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/90 mb-1">Recent Time (HH:MM:SS)</label>
                    <div className="flex gap-2">
                      <input type="number" min="0" value={calcRecentHours} onChange={(e) => setCalcRecentHours(Number(e.target.value))} className="w-1/3 p-2.5 rounded-lg border-2 border-foreground bg-white text-center font-medium focus:ring-0" placeholder="HH" />
                      <input type="number" min="0" max="59" value={calcRecentMinutes} onChange={(e) => setCalcRecentMinutes(Number(e.target.value))} className="w-1/3 p-2.5 rounded-lg border-2 border-foreground bg-white text-center font-medium focus:ring-0" placeholder="MM" />
                      <input type="number" min="0" max="59" value={calcRecentSeconds} onChange={(e) => setCalcRecentSeconds(Number(e.target.value))} className="w-1/3 p-2.5 rounded-lg border-2 border-foreground bg-white text-center font-medium focus:ring-0" placeholder="SS" />
                    </div>
                  </div>

                  <div className="bg-foreground rounded-xl p-4 flex justify-between items-center text-white mt-2">
                    <div>
                      <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-widest mb-1">Estimated Time</div>
                      <div className="text-xl font-black font-display text-secondary">{formatTime(estimatedTimeSecs)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-widest mb-1">Target Pace</div>
                      <div className="text-xl font-black font-display text-bg">{formatTime(estimatedPaceSecs)} <span className="text-sm">/km</span></div>
                    </div>
                  </div>

                  <button
                    onClick={applyCalculatorToGoal}
                    className="w-full bg-white border-2 border-foreground shadow-brutal-sm hover:translate-y-px hover:shadow-brutal-xs active:translate-y-1 active:shadow-none text-foreground font-black py-2.5 px-4 rounded-lg transition-all text-sm mt-2"
                  >
                    Apply to Goal
                  </button>
                </motion.div>
              )}
            </div>

            <button
              onClick={generatePlan}
              disabled={generatingPlan || !raceDate || !timeGoal.trim()}
              className="w-full bg-primary hover:bg-primary-hover disabled:bg-foreground/30 disabled:shadow-none disabled:border-foreground/30 disabled:cursor-not-allowed hover:-translate-y-1 text-white font-black text-xl tracking-wide py-4 px-4 rounded-xl border-4 border-foreground shadow-brutal hover:shadow-brutal-lg active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
            >
              {generatingPlan ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  Generate Plan
                  <ArrowRight className="w-6 h-6 stroke-[3]" />
                </>
              )}
            </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

          {/* Overview Slate (Only shows if plan is generated) */}
          {plan && parsedPlan.overview && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-secondary rounded-3xl border-4 border-foreground shadow-brutal-xl overflow-hidden"
            >
              <button 
                onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
                className="w-full p-6 lg:p-8 flex items-center justify-between text-left focus:outline-none focus:bg-foreground/5 transition-colors"
              >
                <div className="flex items-center gap-3 text-foreground font-display font-black text-xl tracking-tight">
                  <Info className="w-6 h-6 stroke-[3]" />
                  Overview
                </div>
                <div className="text-foreground">
                  {isOverviewExpanded ? <ChevronUp className="w-6 h-6 stroke-[3]" /> : <ChevronDown className="w-6 h-6 stroke-[3]" />}
                </div>
              </button>

              <AnimatePresence>
                {isOverviewExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 pb-6 lg:px-8 lg:pb-8 border-t-2 border-foreground/10 pt-4"
                  >
                    <div className="prose prose-sm prose-stone prose-p:font-medium prose-p:text-foreground/90 max-w-none">
                      <Markdown>{parsedPlan.overview}</Markdown>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          )}

          {/* Tips Carousel Section */}
          {plan && parsedPlan.tipsArray.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border-4 border-foreground shadow-brutal-xl p-6 lg:p-8"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 text-foreground font-display font-black text-xl tracking-tight">
                  <PersonStanding className="w-6 h-6 stroke-[3]" />
                  Buddy's Tips
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCurrentTipIndex(prev => (prev - 1 + parsedPlan.tipsArray.length) % parsedPlan.tipsArray.length)}
                    className="p-1 rounded-lg border-2 border-foreground hover:bg-foreground/10 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[3]" />
                  </button>
                  <span className="text-xs font-black font-mono">
                    {currentTipIndex + 1}/{parsedPlan.tipsArray.length}
                  </span>
                  <button 
                    onClick={() => setCurrentTipIndex(prev => (prev + 1) % parsedPlan.tipsArray.length)}
                    className="p-1 rounded-lg border-2 border-foreground hover:bg-foreground/10 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>
              </div>
              <div className="relative h-20 flex items-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentTipIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="w-full text-foreground/90 font-bold text-sm leading-relaxed"
                  >
                    {parsedPlan.tipsArray[currentTipIndex]}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.section>
          )}

          {/* Recent Activities */}
          <motion.section 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-primary text-white rounded-3xl border-4 border-foreground shadow-brutal-xl overflow-hidden"
          >
            <div className="p-6 lg:p-8">
              <div className="flex items-center justify-between mb-6 border-b-2 border-white/20 pb-4">
                <div className="flex items-center gap-3 font-display font-black">
                  <div className="bg-white text-foreground p-2 border-2 border-foreground rounded-lg transform -rotate-3">
                    <TrendingUp className="w-6 h-6 stroke-[3]" />
                  </div>
                  <h2 className="text-2xl uppercase tracking-widest">Recent Runs</h2>
                </div>
                <span className="text-sm font-black bg-white text-foreground border-2 border-foreground shadow-brutal-sm px-3 py-1 rounded-full">
                  {activities.length}
                </span>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {activities.length === 0 ? (
                  <div className="p-5 bg-white/10 rounded-2xl border-2 border-white/20 space-y-5">
                    <p className="text-sm font-medium">
                      No recent runs found on Strava. Tell us about your current fitness:
                    </p>
                    <div>
                      <label className="block text-xs font-black mb-2 tracking-wide">FREQUENCY</label>
                      <select 
                        value={manualFrequency} 
                        onChange={(e) => setManualFrequency(e.target.value)} 
                        className="w-full p-3 rounded-xl border-2 border-transparent bg-white/20 text-white font-medium focus:bg-white focus:text-foreground transition-colors"
                      >
                        <option className="text-foreground">0 times a week (Starting from scratch)</option>
                        <option className="text-foreground">1-2 times a week</option>
                        <option className="text-foreground">3-4 times a week</option>
                        <option className="text-foreground">5+ times a week</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black mb-2 tracking-wide">MAX DIST (km)</label>
                        <input 
                          type="number" 
                          value={manualDistance} 
                          onChange={(e) => setManualDistance(e.target.value)} 
                          placeholder="e.g., 5" 
                          className="w-full p-3 rounded-xl border-2 border-transparent bg-white/20 text-white placeholder-white/50 font-black focus:bg-white focus:text-foreground transition-colors" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black mb-2 tracking-wide">TIME (MM:SS)</label>
                        <input 
                          type="text" 
                          value={manualTime} 
                          onChange={(e) => setManualTime(e.target.value)} 
                          placeholder="30:00" 
                          className="w-full p-3 rounded-xl border-2 border-transparent bg-white/20 text-white placeholder-white/50 font-black focus:bg-white focus:text-foreground transition-colors" 
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  activities.slice(0, 10).map((activity, i) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={activity.id}
                      className="p-4 rounded-2xl bg-white border-2 border-foreground shadow-brutal text-foreground hover:-translate-y-1 hover:shadow-brutal-lg transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-black font-display text-lg tracking-tight truncate pr-4">
                          {activity.name}
                        </div>
                        <div className="text-xs font-bold text-foreground/60 whitespace-nowrap bg-foreground/10 px-2 py-1 rounded-md border border-foreground/20">
                          {format(new Date(activity.start_date), "MMM d")}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Dist</span>
                          <span><strong className="text-foreground text-lg">{(activity.distance / 1000).toFixed(2)}</strong> km</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Time</span>
                          <span><strong className="text-foreground text-lg">{Math.round(activity.moving_time / 60)}</strong> min</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Pace</span>
                          <span>
                            <strong className="text-foreground text-lg">
                              {Math.floor(1000 / activity.average_speed / 60)}:
                              {String(
                                Math.floor((1000 / activity.average_speed) % 60),
                              ).padStart(2, "0")}
                            </strong> /km
                          </span>
                        </div>
                        {activity.average_heartrate && (
                           <div className="flex flex-col">
                            <span className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">HR</span>
                            <span><strong className="text-primary-hover text-lg">{Math.round(activity.average_heartrate)}</strong> bpm</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.section>
        </div>

        {/* Right Column: The Plan */}
        <div className="lg:col-span-7">
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-primary-hover/40 rounded-3xl border-4 border-foreground shadow-brutal-xl p-6 lg:p-10 min-h-[700px] h-full"
          >
            {plan ? (
              <div className="flex flex-col h-full">
                {isAuthenticated && (
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={savePlan}
                      disabled={savingPlan}
                      className="bg-primary text-white font-bold px-4 py-2 rounded-lg border-2 border-foreground shadow-brutal-sm hover:translate-y-px hover:shadow-brutal-xs flex items-center gap-2 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                    >
                      {savingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 stroke-[3]" />}
                      Save Plan
                    </button>
                  </div>
                )}
                <div className="prose prose-stone prose-p:text-foreground/80 prose-li:text-foreground/80 prose-headings:font-display prose-headings:font-black prose-headings:tracking-tight prose-a:text-primary max-w-none bg-white p-6 rounded-2xl border-2 border-foreground/20">
                  <div className="markdown-body">
                    <Markdown remarkPlugins={[remarkGfm]}>{parsedPlan.weekly || plan}</Markdown>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-foreground/60 space-y-6 py-20">
                <div className="w-24 h-24 bg-foreground/10 border-4 border-foreground/20 rounded-[2rem] flex items-center justify-center transform rotate-6">
                  <Target className="w-12 h-12 text-foreground/50" />
                </div>
                <div className="max-w-xs">
                  <h3 className="font-display font-black text-2xl text-foreground mb-2 tracking-tight">Ready to Run?</h3>
                  <p className="font-medium">Set a goal and generate your personalized training plan crafted by AI.</p>
                </div>
              </div>
            )}
          </motion.section>
        </div>
      </main>
    </div>
  );
}
