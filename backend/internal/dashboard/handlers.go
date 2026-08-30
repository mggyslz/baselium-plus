package dashboard

import (
	"bytes"
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"hash/crc32"
	"net/http"
	"strconv"
	"strings"
	"time"

	"baselium/backend/internal/access"
	"baselium/backend/internal/auth"
)

type Handler struct{ DB *sql.DB }

func NewHandler(db *sql.DB) *Handler { return &Handler{DB: db} }

type triageRow struct {
	UserID           int        `json:"user_id"`
	FullName         string     `json:"full_name"`
	HighestSeverity  *string    `json:"highest_open_severity"`
	OpenAnomalyCount int        `json:"open_anomaly_count"`
	LastCheckin      *time.Time `json:"last_checkin"`
}

type elderCardRow struct {
	UserID           int        `json:"user_id"`
	FullName         string     `json:"full_name"`
	Gender           *string    `json:"gender"`
	ContactNumber    *string    `json:"contact_number"`
	LastCheckin      *time.Time `json:"last_checkin"`
	OpenAnomalyCount int        `json:"open_anomaly_count"`
	HighestSeverity  *string    `json:"highest_open_severity"`
	IsAssigned       bool       `json:"is_assigned"`
}

type paginatedEldersResponse struct {
	Elders     []elderCardRow `json:"elders"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	Limit      int            `json:"limit"`
	TotalPages int            `json:"total_pages"`
}

const maxEldersPageSize = 50

// PaginatedElders returns a page of elder profile cards using DB-level LIMIT and OFFSET.
func (h *Handler) PaginatedElders(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())

	page := 1
	if pStr := r.URL.Query().Get("page"); pStr != "" {
		if p, err := strconv.Atoi(pStr); err == nil && p > 0 {
			page = p
		}
	}

	limit := 6
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
			limit = l
		}
	}
	if limit > maxEldersPageSize {
		limit = maxEldersPageSize
	}

	offset := (page - 1) * limit

	var total int
	err := h.DB.QueryRow(`
		SELECT COUNT(*) 
		FROM users u
		JOIN accounts a ON a.account_id = u.account_id
		WHERE a.role = 'elder' AND a.is_active = TRUE
	`).Scan(&total)
	if err != nil {
		http.Error(w, `{"error":"db error counting elders"}`, http.StatusInternalServerError)
		return
	}

	totalPages := 0
	if total > 0 {
		totalPages = (total + limit - 1) / limit
	}

	rows, err := h.DB.Query(`
		SELECT u.user_id, u.full_name, u.gender, u.contact_number,
		       (SELECT MAX(checkin_time) FROM check_ins c WHERE c.user_id = u.user_id) AS last_checkin,
		       (SELECT COUNT(*) FROM anomalies a WHERE a.user_id = u.user_id AND a.is_resolved = FALSE AND COALESCE(a.review_status, '') <> 'false_positive') AS open_count,
		       (SELECT a.severity FROM anomalies a WHERE a.user_id = u.user_id AND a.is_resolved = FALSE
		          ORDER BY CASE a.severity WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC LIMIT 1) AS top_sev,
		       CASE WHEN $2 = 'caregiver' THEN EXISTS(SELECT 1 FROM user_caregiver uc WHERE uc.user_id = u.user_id AND uc.caregiver_id = $1 AND uc.is_active = TRUE) ELSE FALSE END AS is_assigned
		FROM users u
		JOIN accounts a ON a.account_id = u.account_id
		WHERE a.role = 'elder' AND a.is_active = TRUE
		ORDER BY u.user_id ASC
		LIMIT $3 OFFSET $4
	`, claims.ProfileID, claims.Role, limit, offset)
	if err != nil {
		http.Error(w, `{"error":"db error querying elders"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	out := make([]elderCardRow, 0)
	for rows.Next() {
		var e elderCardRow
		if err := rows.Scan(&e.UserID, &e.FullName, &e.Gender, &e.ContactNumber, &e.LastCheckin, &e.OpenAnomalyCount, &e.HighestSeverity, &e.IsAssigned); err == nil {
			out = append(out, e)
		}
	}

	writeJSON(w, http.StatusOK, paginatedEldersResponse{
		Elders:     out,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	})
}

// Triage lists every elder assigned to this caregiver, sorted worst-first
// (severity-sorted triage view per PROJECT_CONTEXT.md goals).
func (h *Handler) Triage(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	rows, err := h.DB.Query(`
		SELECT u.user_id, u.full_name,
		       (SELECT MAX(checkin_time) FROM check_ins c WHERE c.user_id = u.user_id) AS last_checkin,
		       (SELECT COUNT(*) FROM anomalies a WHERE a.user_id = u.user_id AND a.is_resolved = FALSE AND COALESCE(a.review_status, '') <> 'false_positive') AS open_count,
		       (SELECT a.severity FROM anomalies a WHERE a.user_id = u.user_id AND a.is_resolved = FALSE
		          ORDER BY CASE a.severity WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC LIMIT 1) AS top_sev
		FROM users u
		JOIN user_caregiver uc ON uc.user_id = u.user_id
		WHERE uc.caregiver_id = $1 AND uc.is_active = TRUE
	`, claims.ProfileID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var out []triageRow
	for rows.Next() {
		var t triageRow
		if err := rows.Scan(&t.UserID, &t.FullName, &t.LastCheckin, &t.OpenAnomalyCount, &t.HighestSeverity); err == nil {
			out = append(out, t)
		}
	}
	// severity-sorted: high > medium > low > none
	rank := map[string]int{"high": 3, "medium": 2, "low": 1}
	for i := 1; i < len(out); i++ {
		for j := i; j > 0; j-- {
			a, b := out[j], out[j-1]
			ra, rb := 0, 0
			if a.HighestSeverity != nil {
				ra = rank[*a.HighestSeverity]
			}
			if b.HighestSeverity != nil {
				rb = rank[*b.HighestSeverity]
			}
			if ra > rb {
				out[j], out[j-1] = out[j-1], out[j]
			} else {
				break
			}
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// Trend returns raw check-in points plus the active baseline for charting.
func (h *Handler) Trend(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	userID, err := parseUserID(r)
	if err != nil {
		http.Error(w, `{"error":"user_id required"}`, http.StatusBadRequest)
		return
	}
	if claims.Role == "elder" && userID != claims.ProfileID {
		http.Error(w, `{"error":"you can only view your own trend"}`, http.StatusForbidden)
		return
	}
	if claims.Role == "caregiver" && !requireCaregiverElder(w, h.DB, claims.ProfileID, userID) {
		return
	}

	rows, err := h.DB.Query(
		`SELECT checkin_time, mood, activity_level FROM check_ins WHERE user_id = $1 ORDER BY checkin_time DESC LIMIT 30`,
		userID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type point struct {
		Time     time.Time `json:"time"`
		Mood     int       `json:"mood"`
		Activity int       `json:"activity"`
	}
	var points []point
	for rows.Next() {
		var p point
		if err := rows.Scan(&p.Time, &p.Mood, &p.Activity); err == nil {
			points = append(points, p)
		}
	}

	var avgMood, avgActivity, stddevMood, stddevActivity sql.NullFloat64
	h.DB.QueryRow(
		`SELECT avg_mood_score, avg_activity_level, stddev_mood, stddev_activity
		 FROM behavioral_baselines WHERE user_id = $1 AND is_active = TRUE`, userID,
	).Scan(&avgMood, &avgActivity, &stddevMood, &stddevActivity)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"points":            points,
		"baseline_mood":     avgMood.Float64,
		"baseline_activity": avgActivity.Float64,
		"stddev_mood":       stddevMood.Float64,
		"stddev_activity":   stddevActivity.Float64,
	})
}

// AlertHistory lists anomalies for an elder (caregiver: full detail;
// family: high-severity only, per D6).
func (h *Handler) AlertHistory(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	userID, err := parseUserID(r)
	if err != nil {
		http.Error(w, `{"error":"user_id required"}`, http.StatusBadRequest)
		return
	}
	if claims.Role == "caregiver" && !requireCaregiverElder(w, h.DB, claims.ProfileID, userID) {
		return
	}
	if claims.Role == "family" && !requireFamilyElder(w, h.DB, claims.ProfileID, userID) {
		return
	}

	query := `SELECT a.anomaly_id, a.anomaly_type, a.severity, a.deviation_metric, a.deviation_magnitude, a.duration_days, a.detected_at, a.is_resolved,
	                  a.trend_direction, a.review_status, a.reviewed_at, ci.notes, ci.context_note
	           FROM anomalies a LEFT JOIN check_ins ci ON ci.checkin_id = a.checkin_id WHERE a.user_id = $1`
	args := []interface{}{userID}
	if claims.Role == "family" {
		query += ` AND severity = 'high'`
	}
	query += ` ORDER BY detected_at DESC LIMIT 50`

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type row struct {
		AnomalyID          int        `json:"anomaly_id"`
		AnomalyType        string     `json:"anomaly_type"`
		Severity           string     `json:"severity"`
		DeviationMetric    *string    `json:"deviation_metric"`
		DeviationMagnitude float64    `json:"deviation_magnitude"`
		DurationDays       int        `json:"duration_days"`
		DetectedAt         time.Time  `json:"detected_at"`
		IsResolved         bool       `json:"is_resolved"`
		TrendDirection     string     `json:"trend_direction"`
		ReviewStatus       *string    `json:"review_status"`
		ReviewedAt         *time.Time `json:"reviewed_at"`
		Notes              *string    `json:"notes"`
		ContextNote        *string    `json:"context_note"`
	}
	var out []row
	for rows.Next() {
		var rr row
		if err := rows.Scan(&rr.AnomalyID, &rr.AnomalyType, &rr.Severity, &rr.DeviationMetric, &rr.DeviationMagnitude, &rr.DurationDays, &rr.DetectedAt, &rr.IsResolved, &rr.TrendDirection, &rr.ReviewStatus, &rr.ReviewedAt, &rr.Notes, &rr.ContextNote); err == nil {
			out = append(out, rr)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// ResetBaseline starts a new seven-day cold-start period after a material life
// change. It never deletes historical baselines or check-ins.
func (h *Handler) ResetBaseline(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	var req struct {
		UserID int `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID < 1 {
		http.Error(w, `{"error":"valid user_id required"}`, http.StatusBadRequest)
		return
	}
	if !requireCaregiverElder(w, h.DB, claims.ProfileID, req.UserID) {
		return
	}
	tx, err := h.DB.Begin()
	if err != nil {
		http.Error(w, `{"error":"db error"}`, 500)
		return
	}
	defer tx.Rollback()
	if _, err = tx.Exec(`UPDATE users SET baseline_reset_at = now() WHERE user_id = $1`, req.UserID); err != nil {
		http.Error(w, `{"error":"db error"}`, 500)
		return
	}
	if _, err = tx.Exec(`UPDATE behavioral_baselines SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE`, req.UserID); err != nil {
		http.Error(w, `{"error":"db error"}`, 500)
		return
	}
	if _, err = tx.Exec(`INSERT INTO audit_logs (account_id, action, target_type, target_id) VALUES ($1, 'reset_baseline', 'user', $2)`, claims.AccountID, req.UserID); err != nil {
		http.Error(w, `{"error":"db error"}`, 500)
		return
	}
	if err = tx.Commit(); err != nil {
		http.Error(w, `{"error":"db error"}`, 500)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ExportReport creates a portable Excel workbook with the assigned elder's
// check-in history, anomaly history, and a small summary sheet.
func (h *Handler) ExportReport(w http.ResponseWriter, r *http.Request) {
	claims := auth.FromContext(r.Context())
	userID, err := parseUserID(r)
	if err != nil {
		http.Error(w, `{"error":"user_id required"}`, http.StatusBadRequest)
		return
	}
	if !requireCaregiverElder(w, h.DB, claims.ProfileID, userID) {
		return
	}

	var name string
	if err := h.DB.QueryRow(`SELECT full_name FROM users WHERE user_id = $1`, userID).Scan(&name); err != nil {
		http.Error(w, `{"error":"elder not found"}`, http.StatusNotFound)
		return
	}
	checkins, err := h.reportCheckins(userID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	alerts, err := h.reportAlerts(userID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	data, err := makeWorkbook(name, checkins, alerts)
	if err != nil {
		http.Error(w, `{"error":"report generation failed"}`, http.StatusInternalServerError)
		return
	}
	h.DB.Exec(`INSERT INTO audit_logs (account_id, action, target_type, target_id) VALUES ($1, 'export_report', 'user', $2)`, claims.AccountID, userID)
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="baselium-report-%d.xlsx"`, userID))
	w.Write(data)
}

type reportCheckin struct {
	Time           time.Time
	Mood, Activity int
	Notes          string
}
type reportAlert struct {
	Detected               time.Time
	Type, Severity, Metric string
	Magnitude              float64
	Duration               int
	Resolved               bool
}

func (h *Handler) reportCheckins(userID int) ([]reportCheckin, error) {
	rows, err := h.DB.Query(`SELECT checkin_time, mood, activity_level, COALESCE(notes, context_note, '') FROM check_ins WHERE user_id=$1 ORDER BY checkin_time DESC LIMIT 365`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []reportCheckin
	for rows.Next() {
		var v reportCheckin
		if err := rows.Scan(&v.Time, &v.Mood, &v.Activity, &v.Notes); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (h *Handler) reportAlerts(userID int) ([]reportAlert, error) {
	rows, err := h.DB.Query(`SELECT detected_at, anomaly_type, severity, COALESCE(deviation_metric, ''), COALESCE(deviation_magnitude, 0), duration_days, is_resolved FROM anomalies WHERE user_id=$1 ORDER BY detected_at DESC LIMIT 365`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []reportAlert
	for rows.Next() {
		var v reportAlert
		if err := rows.Scan(&v.Detected, &v.Type, &v.Severity, &v.Metric, &v.Magnitude, &v.Duration, &v.Resolved); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func makeWorkbook(name string, checkins []reportCheckin, alerts []reportAlert) ([]byte, error) {
	sheets := [][][]string{
		{{"Report for " + name}, {"Generated " + time.Now().Format(time.RFC3339)}, {"Check-ins", strconv.Itoa(len(checkins))}, {"Alerts", strconv.Itoa(len(alerts))}},
		{{"Check-ins", "Mood", "Activity", "Notes"}},
		{{"Alerts", "Severity", "Metric", "Magnitude", "Duration days", "Status"}},
	}
	for _, v := range checkins {
		sheets[1] = append(sheets[1], []string{v.Time.Format(time.RFC3339), strconv.Itoa(v.Mood), strconv.Itoa(v.Activity), v.Notes})
	}
	for _, v := range alerts {
		status := "Open"
		if v.Resolved {
			status = "Acknowledged"
		}
		sheets[2] = append(sheets[2], []string{v.Detected.Format(time.RFC3339), v.Severity, v.Metric, fmt.Sprintf("%.2f", v.Magnitude), strconv.Itoa(v.Duration), status})
	}
	files := map[string]string{
		"[Content_Types].xml":        `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
		"_rels/.rels":                `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
		"xl/workbook.xml":            `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/><sheet name="Check-ins" sheetId="2" r:id="rId2"/><sheet name="Alerts" sheetId="3" r:id="rId3"/></sheets></workbook>`,
		"xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>`,
	}
	entries := make([]xlsxEntry, 0, len(files)+3)
	for path, content := range files {
		entries = append(entries, xlsxEntry{name: path, data: []byte(content)})
	}
	for i, rows := range sheets {
		entries = append(entries, xlsxEntry{name: fmt.Sprintf("xl/worksheets/sheet%d.xml", i+1), data: []byte(sheetXML(rows))})
	}
	return writeStoredZip(entries), nil
}

type xlsxEntry struct {
	name   string
	data   []byte
	offset uint32
}

// writeStoredZip writes the minimal ZIP container needed by .xlsx files.
// Entries are intentionally stored rather than compressed to avoid an external
// dependency and keep export deterministic.
func writeStoredZip(entries []xlsxEntry) []byte {
	var out bytes.Buffer
	for i := range entries {
		e := &entries[i]
		e.offset = uint32(out.Len())
		name := []byte(e.name)
		crc := crc32.ChecksumIEEE(e.data)
		binary.Write(&out, binary.LittleEndian, uint32(0x04034b50))
		binary.Write(&out, binary.LittleEndian, uint16(20))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		binary.Write(&out, binary.LittleEndian, crc)
		binary.Write(&out, binary.LittleEndian, uint32(len(e.data)))
		binary.Write(&out, binary.LittleEndian, uint32(len(e.data)))
		binary.Write(&out, binary.LittleEndian, uint16(len(name)))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		out.Write(name)
		out.Write(e.data)
	}
	centralStart := uint32(out.Len())
	for _, e := range entries {
		name := []byte(e.name)
		crc := crc32.ChecksumIEEE(e.data)
		binary.Write(&out, binary.LittleEndian, uint32(0x02014b50))
		binary.Write(&out, binary.LittleEndian, uint16(20))
		binary.Write(&out, binary.LittleEndian, uint16(20))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		binary.Write(&out, binary.LittleEndian, crc)
		binary.Write(&out, binary.LittleEndian, uint32(len(e.data)))
		binary.Write(&out, binary.LittleEndian, uint32(len(e.data)))
		binary.Write(&out, binary.LittleEndian, uint16(len(name)))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		binary.Write(&out, binary.LittleEndian, uint16(0))
		binary.Write(&out, binary.LittleEndian, uint32(0))
		binary.Write(&out, binary.LittleEndian, e.offset)
		out.Write(name)
	}
	centralSize := uint32(out.Len()) - centralStart
	count := uint16(len(entries))
	binary.Write(&out, binary.LittleEndian, uint32(0x06054b50))
	binary.Write(&out, binary.LittleEndian, uint16(0))
	binary.Write(&out, binary.LittleEndian, uint16(0))
	binary.Write(&out, binary.LittleEndian, count)
	binary.Write(&out, binary.LittleEndian, count)
	binary.Write(&out, binary.LittleEndian, centralSize)
	binary.Write(&out, binary.LittleEndian, centralStart)
	binary.Write(&out, binary.LittleEndian, uint16(0))
	return out.Bytes()
}
func sheetXML(rows [][]string) string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`)
	for i, row := range rows {
		b.WriteString(fmt.Sprintf(`<row r="%d">`, i+1))
		for _, value := range row {
			b.WriteString(`<c t="inlineStr"><is><t>`)
			var escaped bytes.Buffer
			xml.EscapeText(&escaped, []byte(value))
			b.WriteString(escaped.String())
			b.WriteString(`</t></is></c>`)
		}
		b.WriteString(`</row>`)
	}
	b.WriteString(`</sheetData></worksheet>`)
	return b.String()
}

func parseUserID(r *http.Request) (int, error) {
	return strconv.Atoi(r.URL.Query().Get("user_id"))
}

func requireCaregiverElder(w http.ResponseWriter, db *sql.DB, caregiverID, userID int) bool {
	allowed, err := access.CaregiverHasElder(db, caregiverID, userID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return false
	}
	if !allowed {
		http.Error(w, `{"error":"elder is not assigned to you"}`, http.StatusForbidden)
		return false
	}
	return true
}

func requireFamilyElder(w http.ResponseWriter, db *sql.DB, familyID, userID int) bool {
	allowed, err := access.FamilyHasElder(db, familyID, userID)
	if err != nil {
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return false
	}
	if !allowed {
		http.Error(w, `{"error":"family access was not granted for this elder"}`, http.StatusForbidden)
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
