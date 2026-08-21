package anomaly

import "testing"

func TestSeverityClassification(t *testing.T) {
	cases := []struct {
		name      string
		magnitude float64
		days      int
		want      string
	}{
		{"one-off deviation", 2.6, 1, "low"},
		{"sustained deviation", 1.6, 3, "medium"},
		{"large sustained deviation", 2.6, 4, "high"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifySeverity(tc.magnitude, tc.days); got != tc.want {
				t.Fatalf("classifySeverity(%v, %d) = %q, want %q", tc.magnitude, tc.days, got, tc.want)
			}
		})
	}
}

func TestFrequencySeverity(t *testing.T) {
	if got := severityForFrequency(.20); got != "high" {
		t.Fatalf("frequency .20 = %q, want high", got)
	}
	if got := severityForFrequency(.40); got != "medium" {
		t.Fatalf("frequency .40 = %q, want medium", got)
	}
	if got := severityForFrequency(.75); got != "low" {
		t.Fatalf("frequency .75 = %q, want low", got)
	}
}
