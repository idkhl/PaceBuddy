import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowLeft, Loader2, Calendar } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Plan {
  id: number;
  title: string;
  plan_text: string;
  created_at: string;
}

export default function SavedPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to load plans. Make sure you are logged in.");
      const data = await res.json();
      setPlans(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg selection:bg-primary selection:text-white pb-20">
      <header className="bg-white border-b-4 border-foreground sticky top-0 z-20 shadow-[0_4px_0_0_#080708]">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 text-foreground font-display font-black text-2xl tracking-tighter hover:opacity-80 transition-opacity">
            <div className="bg-primary text-white p-2 rounded-xl border-2 border-foreground transform -rotate-6">
              <Activity className="w-6 h-6 stroke-[3]" />
            </div>
            PaceBuddy
          </Link>
          <Link
            to="/"
            className="text-foreground/70 hover:text-foreground hover:-translate-y-0.5 bg-white border-2 border-transparent hover:border-foreground hover:shadow-brutal px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all active:translate-y-0 active:shadow-none"
          >
            <ArrowLeft className="w-4 h-4 stroke-[3]" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="font-display font-black text-4xl uppercase tracking-widest text-foreground mb-8">
          Saved Training Plans
        </h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="bg-white border-4 border-foreground shadow-brutal p-8 rounded-2xl text-center text-foreground font-bold">
            {error}
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white border-4 border-foreground shadow-brutal p-12 rounded-2xl text-center text-foreground font-medium">
            <div className="w-20 h-20 bg-secondary/30 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-foreground">
              <Calendar className="w-10 h-10 text-foreground" />
            </div>
            <p className="text-xl font-bold mb-2">No saved plans yet.</p>
            <p className="opacity-70 mb-6">Generate your first training plan on the dashboard and save it!</p>
            <Link to="/" className="inline-block bg-primary text-white font-bold px-6 py-3 rounded-xl border-2 border-foreground shadow-brutal-sm hover:translate-y-px hover:shadow-brutal-xs active:translate-y-1 active:shadow-none transition-all">
              Create a Plan
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-4">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`w-full text-left p-5 rounded-2xl border-4 transition-all ${
                    selectedPlan?.id === plan.id
                      ? "bg-primary text-white border-foreground shadow-brutal translate-y-[-2px]"
                      : "bg-white text-foreground border-foreground shadow-brutal-sm hover:translate-y-[-2px] hover:shadow-brutal"
                  }`}
                >
                  <h3 className="font-display font-black text-lg mb-1 truncate">{plan.title}</h3>
                  <p className={`text-xs font-bold ${selectedPlan?.id === plan.id ? "text-white/80" : "text-foreground/60"}`}>
                    Generated on {new Date(plan.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>

            <div className="lg:col-span-8">
              {selectedPlan ? (
                <div className="bg-white rounded-3xl border-4 border-foreground shadow-brutal-xl p-6 lg:p-10">
                  <h2 className="font-display font-black text-2xl mb-6 pb-4 border-b-4 border-foreground/10">{selectedPlan.title}</h2>
                  <div className="prose prose-stone prose-p:text-foreground/80 prose-li:text-foreground/80 prose-headings:font-display prose-headings:font-black prose-headings:tracking-tight prose-a:text-primary max-w-none">
                    <div className="markdown-body">
                      <Markdown remarkPlugins={[remarkGfm]}>{selectedPlan.plan_text}</Markdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-foreground/5 rounded-3xl border-4 border-dashed border-foreground/30 p-10 h-[500px] flex items-center justify-center text-foreground/50 font-bold text-center">
                  Select a plan from the list to view its details.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
