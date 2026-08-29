import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import {
  MoodVeryLowIcon,
  MoodLowIcon,
  MoodNeutralIcon,
  MoodGoodIcon,
  MoodGreatIcon,
  ActivityRestIcon,
  ActivityWalkIcon,
  ActivityModerateIcon,
  ActivityActiveIcon,
  ActivityZapIcon,
  CheckCircleIcon,
  MicIcon,
} from "../components/Icons";

const MOOD_OPTIONS = [
  { value: 1, label: "Very Low", icon: MoodVeryLowIcon, color: "#ef4444" },
  { value: 2, label: "Low", icon: MoodLowIcon, color: "#f97316" },
  { value: 3, label: "Okay", icon: MoodNeutralIcon, color: "#eab308" },
  { value: 4, label: "Good", icon: MoodGoodIcon, color: "#3b82f6" },
  { value: 5, label: "Great", icon: MoodGreatIcon, color: "#22c55e" },
];

const ACTIVITY_OPTIONS = [
  { value: 1, label: "Resting", icon: ActivityRestIcon, color: "#64748b" },
  { value: 2, label: "Light Walk", icon: ActivityWalkIcon, color: "#0284c7" },
  { value: 3, label: "Moderate", icon: ActivityModerateIcon, color: "#0d9488" },
  { value: 4, label: "Active", icon: ActivityActiveIcon, color: "#16a34a" },
  { value: 5, label: "Very Active", icon: ActivityZapIcon, color: "#8b5cf6" },
];

interface CheckinResult {
  anomalies_raised?: Array<{ severity: string; type: string }>;
}

interface CheckinRecord {
  checkin_id: string;
  checkin_time: string;
  mood: number;
  activity_level: number;
  notes?: string;
}

export default function ElderCheckin() {
  const { session } = useAuth();
  const [mood, setMood] = useState<number>(3);
  const [activity, setActivity] = useState<number>(3);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<CheckinRecord[]>([]);
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

  function renderMoodIcon(val: number, size = 24) {
    const opt = MOOD_OPTIONS.find((m) => m.value === val);
    if (!opt) return null;
    const IconComp = opt.icon;
    return <IconComp size={size} color={opt.color} />;
  }

  function renderActivityIcon(val: number, size = 24) {
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
            <div className="emoji-grid" role="radiogroup" aria-labelledby="mood-label">
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
                    className={`emoji-btn ${isSelected ? "selected" : ""}`}
                    onClick={() => setMood(opt.value)}
                  >
                    <span className="emoji-icon" aria-hidden="true">
                      <Icon size={30} color={isSelected ? opt.color : "#64748b"} />
                    </span>
                    <span className="emoji-text">{opt.label}</span>
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
            <div className="emoji-grid" role="radiogroup" aria-labelledby="activity-label">
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
                    className={`emoji-btn ${isSelected ? "selected" : ""}`}
                    onClick={() => setActivity(opt.value)}
                  >
                    <span className="emoji-icon" aria-hidden="true">
                      <Icon size={30} color={isSelected ? opt.color : "#64748b"} />
                    </span>
                    <span className="emoji-text">{opt.label}</span>
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
                  <MicIcon size={14} /> {isListening ? "Listening…" : "Voice Note"}
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
            {submitting ? "Saving Check-in…" : "Submit Check-in ✨"}
          </button>
        </form>

        {result && (
          <div className="checkin-success-banner" role="alert">
            <div className="checkin-success-title">
              <CheckCircleIcon size={20} color="#166534" /> Check-in saved successfully!
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
        <h2 style={{ fontSize: 18 }}>Your recent check-ins</h2>
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
    </div>
  );
}
