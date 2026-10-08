package anomaly

import "testing"

func TestSeverityClassification(t *testing.T) {
	cases := []struct {
		name      string
		magnitude float64
		days      int
		want      string
	}{
		{"one-off magnitude band", 2.6, 1, "medium"},
		{"three-day low band", 1.6, 3, "low"},
		{"three-day medium band", 2.6, 3, "medium"},
		{"three-day high band", 3.1, 3, "high"},
		{"five-day escalation", 1.6, 5, "medium"},
		{"five-day high escalation", 2.6, 5, "high"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifySeverity(tc.magnitude, tc.days); got != tc.want {
				t.Fatalf("classifySeverity(%v, %d) = %q, want %q", tc.magnitude, tc.days, got, tc.want)
			}
		})
	}
}

func TestCheckDeviationRequiresThreeConsecutiveDays(t *testing.T) {
	if got := checkDeviation(1, 1, 1, "mood_deviation", "mood", 1, 4, 0, 2); got != nil {
		t.Fatalf("two-day deviation = %#v, want nil", got)
	}
	if got := checkDeviation(1, 1, 1, "mood_deviation", "mood", 1, 4, 0, 3); got == nil {
		t.Fatal("three-day deviation = nil, want anomaly")
	}
}

func TestCheckDeviationUsesStddevFloor(t *testing.T) {
	a := checkDeviation(1, 1, 1, "mood_deviation", "mood", 3, 4, 0, 3)
	if a == nil || a.DeviationMagnitude != 2 {
		t.Fatalf("stddev-floor anomaly = %#v, want magnitude 2", a)
	}
}

func TestColdStartUsesConservativeThreshold(t *testing.T) {
	if got := checkColdStartDeviation(1, 1, 1, "mood_deviation", "mood", 3, 4, 0); got != nil {
		t.Fatalf("2-z cold-start deviation = %#v, want nil", got)
	}
	if got := checkColdStartDeviation(1, 1, 1, "mood_deviation", "mood", 2, 4, 0); got == nil {
		t.Fatal("4-z cold-start deviation = nil, want anomaly")
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
