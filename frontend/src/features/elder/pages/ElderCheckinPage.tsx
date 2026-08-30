import { useEffect, useState } from "react";
import { api } from "../../../shared/api/client";
import { useAuth } from "../../auth/auth.context";
import {
  Frown,
  Meh,
  Smile,
  SmilePlus,
  Sparkles,
  Bed,
  Footprints,
  Home,
  Activity as ActivityIcon,
  Zap,
  CheckCircle2,
  Mic,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const MOOD_OPTIONS = [
  { value: 1, label: "Very Low", icon: Frown, color: "#ef4444" },
  { value: 2, label: "Low", icon: Meh, color: "#f97316" },
  { value: 3, label: "Okay", icon: Smile, color: "#eab308" },
  { value: 4, label: "Good", icon: SmilePlus, color: "#3b82f6" },
  { value: 5, label: "Great", icon: Sparkles, color: "#22c55e" },
];

const ACTIVITY_OPTIONS = [
  { value: 1, label: "Resting", icon: Bed, color: "#64748b" },
  { value: 2, label: "Light Walk", icon: Footprints, color: "#0284c7" },
  { value: 3, label: "Moderate", icon: Home, color: "#0d9488" },
  { value: 4, label: "Active", icon: ActivityIcon, color: "#16a34a" },
  { value: 5, label: "Very Active", icon: Zap, color: "#8b5cf6" },
];

type CheckinResult = import("../../../shared/types/models").CheckinResult;
type CheckinRecord = import("../../../shared/types/models").Checkin;

export default function ElderCheckin() {
  const { session } = useAuth();
  const [mood, setMood] = useState<number>(3);
  const [activity, setActivity] = useState<number>(3);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<CheckinRecord[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
    }
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const data = await api.checkinHistory(session.token);
      setHistory(data || []);
    } catch {
      // non-fatal
    }
  }

  function handleVoiceNote() {
    const SpeechRecognition = (window as unknown as Record<string, any>).SpeechRecognition || (window as unknown as Record<string, any>).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setNote((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setSubmitting(true);
    try {
      const data = await api.submitCheckin(session.token, {
        mood: Number(mood),
        activity_level: Number(activity),
        notes: note,
      });
      setResult(data);
      setNote("");
      loadHistory();
    } catch (err: any) {
      setError(err.message || "Failed to submit check-in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderMoodIcon(val: number, size = 22) {
    const opt = MOOD_OPTIONS.find((m) => m.value === val);
    if (!opt) return null;
    const IconComp = opt.icon;
    return <IconComp size={size} color={opt.color} />;
  }

  function renderActivityIcon(val: number, size = 22) {
    const opt = ACTIVITY_OPTIONS.find((a) => a.value === val);
    if (!opt) return null;
    const IconComp = opt.icon;
    return <IconComp size={size} color={opt.color} />;
  }

  return (
    <div className="container" style={{ maxWidth: 620 }}>
      <div className="card">
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>How are you feeling today?</h2>
        <p className="rating-hint" style={{ marginBottom: 20 }}>
          Select the icons that best match your day.
        </p>

        <form onSubmit={handleSubmit} className="stack" style={{ maxWidth: "100%", gap: 24 }}>
          {/* Mood Selector */}
          <div className="rating-section">
            <label id="mood-label">
              1. How is your mood today?
            </label>
            <div className="rating-grid" role="radiogroup" aria-labelledby="mood-label">
              {MOOD_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = mood === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${opt.value} - ${opt.label}`}
                    className={`rating-btn ${isSelected ? "selected" : ""}`}
                    onClick={() => setMood(opt.value)}
                  >
                    <span className="rating-icon" aria-hidden="true">
                      <Icon size={28} color={isSelected ? opt.color : "#64748b"} />
                    </span>
                    <span className="rating-text">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity Selector */}
          <div className="rating-section">
            <label id="activity-label">
              2. How active were you today?
            </label>
            <div className="rating-grid" role="radiogroup" aria-labelledby="activity-label">
              {ACTIVITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = activity === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${opt.value} - ${opt.label}`}
                    className={`rating-btn ${isSelected ? "selected" : ""}`}
                    onClick={() => setActivity(opt.value)}
                  >
                    <span className="rating-icon" aria-hidden="true">
                      <Icon size={28} color={isSelected ? opt.color : "#64748b"} />
                    </span>
                    <span className="rating-text">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes Input */}
          <div className="rating-section">
            <div className="voice-note-bar">
              <label htmlFor="checkin-note">
                3. Anything you'd like to share? (optional)
              </label>
              {speechSupported && (
                <button
                  type="button"
                  className={`btn-voice ${isListening ? "listening" : ""}`}
                  onClick={handleVoiceNote}
                  title="Speak note"
                >
                  <Mic size={14} /> {isListening ? "Listening…" : "Voice Note"}
                </button>
              )}
            </div>
            <textarea
              id="checkin-note"
              rows={3}
              placeholder="e.g. Went for a stroll, slept well, feeling a little tired..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ fontSize: 15, padding: 12 }}
            />
          </div>

          {error && <div className="error" style={{ fontSize: 14 }}>{error}</div>}

          <button type="submit" className="submit-btn-large" disabled={submitting}>
            {submitting ? "Saving Check-in…" : "Submit Check-in"}
          </button>
        </form>

        {result && (
          <div className="checkin-success-banner" role="alert">
            <div className="checkin-success-title">
              <CheckCircle2 size={20} color="#166534" /> Check-in saved successfully!
            </div>
            {result.anomalies_raised && result.anomalies_raised.length > 0 ? (
              <div style={{ marginTop: 6, fontSize: 14 }}>
                Your caregiver{result.anomalies_raised.length > 1 ? "s were" : " was"} notified about {result.anomalies_raised.length} change{result.anomalies_raised.length > 1 ? "s" : ""} in your pattern.
              </div>
            ) : (
              <div style={{ marginTop: 4, fontSize: 14, color: "#15803d" }}>
                Thank you for completing your daily check-in. Have a wonderful day!
              </div>
            )}
          </div>
        )}
      </div>

      {/* History */}
      <div className="card">
        <button
          type="button"
          className="collapsible-header"
          onClick={() => setIsHistoryOpen((prev) => !prev)}
          aria-expanded={isHistoryOpen}
          aria-controls="checkin-history-content"
        >
          <h2 style={{ fontSize: 18, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            Your recent check-ins
            {history.length > 0 && (
              <span className="muted" style={{ fontSize: 14, fontWeight: "normal" }}>
                ({history.length})
              </span>
            )}
          </h2>
          <span className="muted" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}>
            {isHistoryOpen ? "Hide" : "Show"}
            {isHistoryOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </span>
        </button>

        {isHistoryOpen && (
          <div id="checkin-history-content" style={{ marginTop: 16 }}>
            {history.length === 0 && <div className="empty-state">No check-ins logged yet.</div>}
            {history.length > 0 && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Mood</th>
                      <th>Activity</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.checkin_id}>
                        <td>{new Date(h.checkin_time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            {renderMoodIcon(h.mood, 20)}
                            <span>{h.mood}/5</span>
                          </div>
                        </td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            {renderActivityIcon(h.activity_level, 20)}
                            <span>{h.activity_level}/5</span>
                          </div>
                        </td>
                        <td className="muted">{h.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
