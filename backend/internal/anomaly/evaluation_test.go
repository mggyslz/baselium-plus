package anomaly

import "testing"

// TestSyntheticQualityGate records the current threshold calibration on a
// deterministic synthetic set: normal 3-5 scores around a 4/5 baseline and
// injected extreme 1/5 scores. It protects the stated recall/false-positive
// targets from accidental threshold regressions.
func TestSyntheticQualityGate(t *testing.T) {
	const baselineMean = 4.0
	const baselineStddev = 0.8
	normal := []float64{3, 4, 5, 4, 3, 5, 4, 4, 3, 5}
	var falsePositives int
	for i := 0; i < 100; i++ {
		value := normal[i%len(normal)]
		if checkDeviation(1, 1, i+1, "mood_deviation", "mood", value, baselineMean, baselineStddev, 1) != nil {
			falsePositives++
		}
	}

	const injected = 20
	var detected int
	for i := 0; i < injected; i++ {
		if checkDeviation(1, 1, 100+i, "mood_deviation", "mood", 1, baselineMean, baselineStddev, 1) != nil {
			detected++
		}
	}
	recall := float64(detected) / injected
	falsePositiveRate := float64(falsePositives) / 100
	if recall < .90 || falsePositiveRate >= .10 {
		t.Fatalf("threshold quality gate failed: recall=%.0f%% false-positive-rate=%.0f%%", recall*100, falsePositiveRate*100)
	}
	t.Logf("threshold calibration: recall=%.0f%% false-positive-rate=%.0f%%", recall*100, falsePositiveRate*100)
}
