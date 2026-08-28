import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function ElderCheckin() {
  const { session } = useAuth();
  const [mood, setMood] = useState<number | string>(3);
  const [activity, setActivity] = useState<number | string>(3);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  async function loadHistory() {
    try {
      const data = await api.checkinHistory(session.token);
      setHistory(data || []);
    } catch (err) {
      // non-fatal
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleSubmit(e) {
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
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <div className="card">
        <h2>How are you today?</h2>
        <form onSubmit={handleSubmit} className="stack">
          <div>
            <label>Mood (1 = very low, 5 = great)</label>
            <div className="slider-row">
              <input type="range" min="1" max="5" value={mood} onChange={(e) => setMood(e.target.value)} />
              <span className="slider-value">{mood}</span>
            </div>
          </div>
          <div>
            <label>Activity level (1 = very inactive, 5 = very active)</label>
            <div className="slider-row">
              <input type="range" min="1" max="5" value={activity} onChange={(e) => setActivity(e.target.value)} />
              <span className="slider-value">{activity}</span>
            </div>
          </div>
          <div>
            <label>Anything you'd like to add? (optional)</label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit check-in"}</button>
        </form>

        {result && (
          <div style={{ marginTop: 16, padding: 12, background: "#f0fdf4", borderRadius: 6, fontSize: 13 }}>
            Check-in saved.
            {result.anomalies_raised && result.anomalies_raised.length > 0 ? (
              <div style={{ marginTop: 6 }}>
                Your caregiver{result.anomalies_raised.length > 1 ? "s were" : " was"} notified about {result.anomalies_raised.length} change{result.anomalies_raised.length > 1 ? "s" : ""} in your pattern.
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 4 }}>Nothing out of the ordinary detected.</div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Your recent check-ins</h2>
        {history.length === 0 && <div className="empty-state">No check-ins yet.</div>}
        {history.length > 0 && (
          <table>
            <thead>
              <tr><th>Date</th><th>Mood</th><th>Activity</th><th>Note</th></tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.checkin_id}>
                  <td>{new Date(h.checkin_time).toLocaleString()}</td>
                  <td>{h.mood}</td>
                  <td>{h.activity_level}</td>
                  <td className="muted">{h.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
