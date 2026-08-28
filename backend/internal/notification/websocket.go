package notification

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"baselium/backend/internal/auth"
	"github.com/coder/websocket"
)

// LiveAlert is the payload sent to an active caregiver dashboard.
type LiveAlert struct {
	Type           string    `json:"type"`
	NotificationID int       `json:"notification_id"`
	AnomalyID      int       `json:"anomaly_id"`
	Message        string    `json:"message"`
	SentAt         time.Time `json:"sent_at"`
}
type client struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

// Hub keeps active browser connections grouped by caregiver profile ID.
type Hub struct {
	mu      sync.RWMutex
	clients map[int]map[*client]struct{}
}

func NewHub() *Hub { return &Hub{clients: make(map[int]map[*client]struct{})} }
func (h *Hub) add(id int, c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[id] == nil {
		h.clients[id] = make(map[*client]struct{})
	}
	h.clients[id][c] = struct{}{}
}
func (h *Hub) remove(id int, c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients[id], c)
	if len(h.clients[id]) == 0 {
		delete(h.clients, id)
	}
}

// Publish returns true when an active dashboard accepted the alert.
func (h *Hub) Publish(caregiverID int, alert LiveAlert) bool {
	payload, err := json.Marshal(alert)
	if err != nil {
		return false
	}
	h.mu.RLock()
	clients := make([]*client, 0, len(h.clients[caregiverID]))
	for c := range h.clients[caregiverID] {
		clients = append(clients, c)
	}
	h.mu.RUnlock()
	accepted := false
	for _, c := range clients {
		c.mu.Lock()
		err := c.conn.Write(context.Background(), websocket.MessageText, payload)
		c.mu.Unlock()
		if err == nil {
			accepted = true
		} else {
			h.remove(caregiverID, c)
			_ = c.conn.Close(websocket.StatusNormalClosure, "delivery failed")
		}
	}
	return accepted
}

// ServeHTTP authenticates before upgrade. Browser WebSocket APIs cannot set
// Authorization, so the existing short-lived JWT is sent as ?token=.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.ParseToken(r.URL.Query().Get("token"))
	if err != nil || claims.Role != "caregiver" {
		http.Error(w, `{"error":"caregiver JWT required"}`, http.StatusUnauthorized)
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return
	}
	c := &client{conn: conn}
	h.add(claims.ProfileID, c)
	defer func() {
		h.remove(claims.ProfileID, c)
		_ = conn.Close(websocket.StatusNormalClosure, "dashboard disconnected")
	}()
	for {
		if _, _, err := conn.Read(r.Context()); err != nil {
			return
		}
	}
}
