package faults

import (
	"testing"
)

func TestComputeDistribution_SampleGating(t *testing.T) {
	// Less than 10 samples
	samples := []float64{10.0, 12.0, 15.0, 11.0, 14.0}
	dist := computeDistribution(samples)

	if dist.SampleCount != 5 {
		t.Errorf("expected sample count 5, got %d", dist.SampleCount)
	}

	// P95 must be gated (nil) when samples < 10
	if dist.P95 != nil {
		t.Errorf("expected P95 to be nil when samples < 10, got %v", *dist.P95)
	}
	if dist.P95Status != "INSUFFICIENT_SAMPLES" {
		t.Errorf("expected P95Status INSUFFICIENT_SAMPLES, got %s", dist.P95Status)
	}

	// P99 must be gated (nil) when samples < 20
	if dist.P99 != nil {
		t.Errorf("expected P99 to be nil when samples < 20, got %v", *dist.P99)
	}
	if dist.P99Status != "INSUFFICIENT_SAMPLES" {
		t.Errorf("expected P99Status INSUFFICIENT_SAMPLES, got %s", dist.P99Status)
	}

	// Now test with 25 samples
	largeSamples := make([]float64, 25)
	for i := 0; i < 25; i++ {
		largeSamples[i] = float64(10 + i)
	}
	dist25 := computeDistribution(largeSamples)

	if dist25.P95 == nil {
		t.Errorf("expected P95 to be computed with 25 samples")
	}
	if dist25.P99 == nil {
		t.Errorf("expected P99 to be computed with 25 samples")
	}
	if dist25.P95Status != "AVAILABLE" {
		t.Errorf("expected P95Status AVAILABLE, got %s", dist25.P95Status)
	}
}

func TestResilienceScorer_InconclusiveWithoutProbe(t *testing.T) {
	scorer := &ResilienceScorer{}

	expMetrics := map[string]interface{}{
		"probes_count": 0,
		"availability_percent": nil,
	}
	baseline := map[string]interface{}{
		"available": false,
	}
	recoveryMetrics := map[string]interface{}{}

	result := scorer.CalculateScore("container_restart", baseline, expMetrics, recoveryMetrics, true)
	if result["grade"] != "INCONCLUSIVE" {
		t.Errorf("expected grade INCONCLUSIVE, got %v", result["grade"])
	}
	if result["has_probe"] != false {
		t.Errorf("expected has_probe false")
	}
}

func TestResilienceScorer_ScoringWithMetrics(t *testing.T) {
	scorer := &ResilienceScorer{}

	avail := 100.0
	mult := 1.10
	dist := LatencyDistribution{
		SampleCount: 25,
		P95: func() *float64 { v := 15.0; return &v }(),
	}

	expMetrics := map[string]interface{}{
		"probes_count":         25,
		"availability_percent": &avail,
		"latency_multiplier":   &mult,
		"latency_distribution": dist,
		"observability_coverage": map[string]interface{}{
			"under_sampled": false,
		},
	}
	baseline := map[string]interface{}{
		"sample_count": 10,
		"available":    true,
	}
	recoveryMetrics := map[string]interface{}{
		"recovered":            true,
		"rto_seconds":          0.8,
		"recovery_probe_count": 5,
	}

	result := scorer.CalculateScore("network_latency", baseline, expMetrics, recoveryMetrics, true)
	score, ok := result["score"].(int)
	if !ok {
		t.Fatalf("expected int score, got %T (%v)", result["score"], result["score"])
	}

	if score < 75 {
		t.Errorf("expected high resilience score (>= 75), got %d", score)
	}
}
