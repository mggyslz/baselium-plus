package baseline

import "testing"

func TestMeanStddev(t *testing.T) {
	mean, stddev := meanStddev([]float64{2, 4, 4, 4, 5, 5, 7, 9})
	if mean != 5 {
		t.Fatalf("mean = %v, want 5", mean)
	}
	if stddev < 2.13 || stddev > 2.14 {
		t.Fatalf("sample stddev = %v, want about 2.14", stddev)
	}
}

func TestMeanStddevEmptyAndSingle(t *testing.T) {
	mean, stddev := meanStddev(nil)
	if mean != 0 || stddev != 0 {
		t.Fatalf("empty mean/stddev = %v/%v, want 0/0", mean, stddev)
	}
	mean, stddev = meanStddev([]float64{3})
	if mean != 3 || stddev != 0 {
		t.Fatalf("single mean/stddev = %v/%v, want 3/0", mean, stddev)
	}
}
