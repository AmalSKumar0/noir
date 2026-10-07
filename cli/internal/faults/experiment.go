package faults

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"noir-cli/internal/docker"
)

const (
	MinSamplesForP99    = 20
	MinSamplesForP95    = 10
	MinSamplesForStdDev = 5
)

type Phase string

const (
	PhaseBaseline Phase = "baseline"
	PhaseFault    Phase = "fault"
	PhaseRecovery Phase = "recovery"
)

type EvidenceState string

const (
	EvidenceStateMeasured          EvidenceState = "MEASURED"
	EvidenceStatePartiallyMeasured EvidenceState = "PARTIALLY_MEASURED"
	EvidenceStateInsufficientData  EvidenceState = "INSUFFICIENT_DATA"
	EvidenceStateInconclusive      EvidenceState = "INCONCLUSIVE"
)

type ProbeObservation struct {
	Seq             int      `json:"seq"`
	Phase           Phase    `json:"phase"`
	Timestamp       float64  `json:"timestamp"`
	Endpoint        string   `json:"endpoint"`
	HTTPStatus      *int     `json:"http_status"`
	Success         bool     `json:"success"`
	LatencyMs       *float64 `json:"latency_ms"`
	RawElapsedMs    float64  `json:"raw_elapsed_ms"`
	Timeout         bool     `json:"timeout"`
	ErrorType       string   `json:"error_type,omitempty"`
	ErrorMessage    string   `json:"error_message,omitempty"`
	ProbeDurationMs *float64 `json:"probe_duration_ms,omitempty"`
}

type LatencyDistribution struct {
	SampleCount         int      `json:"sample_count"`
	InsufficientSamples bool     `json:"insufficient_samples"`
	Status              string   `json:"status"`
	Min                 *float64 `json:"min"`
	Max                 *float64 `json:"max"`
	Mean                *float64 `json:"mean"`
	Median              *float64 `json:"median"`
	P50                 *float64 `json:"p50"`
	P75                 *float64 `json:"p75"`
	P90                 *float64 `json:"p90"`
	P95                 *float64 `json:"p95"`
	P99                 *float64 `json:"p99"`
	P95Status           string   `json:"p95_status"`
	P99Status           string   `json:"p99_status"`
	StdDev              *float64 `json:"stddev"`
	Variance            *float64 `json:"variance"`
}

func safePercentile(sortedValues []float64, p float64) *float64 {
	n := len(sortedValues)
	if n == 0 {
		return nil
	}
	if p >= 99 && n < MinSamplesForP99 {
		return nil
	}
	if p >= 95 && n < MinSamplesForP95 {
		return nil
	}
	idx := int(math.Ceil((p/100.0)*float64(n))) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= n {
		idx = n - 1
	}
	val := math.Round(sortedValues[idx]*100) / 100
	return &val
}

func computeDistribution(values []float64) LatencyDistribution {
	if len(values) == 0 {
		return LatencyDistribution{
			SampleCount:         0,
			InsufficientSamples: true,
			Status:              string(EvidenceStateInsufficientData),
			P95Status:           "INSUFFICIENT_SAMPLES",
			P99Status:           "INSUFFICIENT_SAMPLES",
		}
	}

	sv := make([]float64, len(values))
	copy(sv, values)
	sort.Float64s(sv)
	n := len(sv)

	sum := 0.0
	for _, v := range sv {
		sum += v
	}
	mean := math.Round((sum/float64(n))*100) / 100
	minVal := math.Round(sv[0]*100) / 100
	maxVal := math.Round(sv[n-1]*100) / 100

	p50 := safePercentile(sv, 50)
	p75 := safePercentile(sv, 75)
	p90 := safePercentile(sv, 90)
	p95 := safePercentile(sv, 95)
	p99 := safePercentile(sv, 99)

	var stdDev *float64
	var variance *float64
	if n >= MinSamplesForStdDev {
		var sqDiffSum float64
		for _, v := range sv {
			diff := v - mean
			sqDiffSum += diff * diff
		}
		vari := sqDiffSum / float64(n-1)
		sd := math.Sqrt(vari)
		variRounded := math.Round(vari*1000) / 1000
		sdRounded := math.Round(sd*1000) / 1000
		variance = &variRounded
		stdDev = &sdRounded
	}

	st := string(EvidenceStatePartiallyMeasured)
	if n >= MinSamplesForP95 {
		st = string(EvidenceStateMeasured)
	}

	p95Status := "INSUFFICIENT_SAMPLES"
	if p95 != nil {
		p95Status = "AVAILABLE"
	}
	p99Status := "INSUFFICIENT_SAMPLES"
	if p99 != nil {
		p99Status = "AVAILABLE"
	}

	return LatencyDistribution{
		SampleCount:         n,
		InsufficientSamples: false,
		Status:              st,
		Min:                 &minVal,
		Max:                 &maxVal,
		Mean:                &mean,
		Median:              p50,
		P50:                 p50,
		P75:                 p75,
		P90:                 p90,
		P95:                 p95,
		P99:                 p99,
		P95Status:           p95Status,
		P99Status:           p99Status,
		StdDev:              stdDev,
		Variance:            variance,
	}
}

type ChaosProbe struct{}

func (cp *ChaosProbe) Probe(url string, timeoutSec float64, expectedStatus int, phase Phase, seq int) ProbeObservation {
	t0 := float64(time.Now().UnixNano()) / 1e9
	client := &http.Client{
		Timeout: time.Duration(timeoutSec * float64(time.Second)),
	}

	start := time.Now()
	resp, err := client.Get(url)
	elapsedMs := float64(time.Since(start).Nanoseconds()) / 1e6
	elapsedMs = math.Round(elapsedMs*100) / 100

	if err != nil {
		isTimeout := strings.Contains(strings.ToLower(err.Error()), "timeout") || strings.Contains(strings.ToLower(err.Error()), "deadline")
		errType := "connection_error"
		if isTimeout {
			errType = "timeout"
		}
		return ProbeObservation{
			Seq:             seq,
			Phase:           phase,
			Timestamp:       t0,
			Endpoint:        url,
			Success:         false,
			LatencyMs:       nil,
			RawElapsedMs:    elapsedMs,
			Timeout:         isTimeout,
			ErrorType:       errType,
			ErrorMessage:    err.Error(),
			ProbeDurationMs: &elapsedMs,
		}
	}
	defer resp.Body.Close()

	code := resp.StatusCode
	success := (code == expectedStatus) || (code >= 200 && code < 400)
	var errType, errMsg string
	if !success {
		errType = "http_error"
		errMsg = fmt.Sprintf("HTTP %d", code)
	}

	return ProbeObservation{
		Seq:             seq,
		Phase:           phase,
		Timestamp:       t0,
		Endpoint:        url,
		HTTPStatus:      &code,
		Success:         success,
		LatencyMs:       &elapsedMs,
		RawElapsedMs:    elapsedMs,
		Timeout:         false,
		ErrorType:       errType,
		ErrorMessage:    errMsg,
		ProbeDurationMs: &elapsedMs,
	}
}

type SteadyStateEvaluator struct {
	ProbeURL               string
	ExpectedStatus         int
	BaselineProbeCount     int
	BaselineIntervalSec    float64
	FaultProbeInterval     float64
	RecoveryProbeInterval  float64
	RecoveryConsecutiveReq int
	DockerMgr              *docker.Manager
	ContainerName          string

	BaselineObservations []ProbeObservation
	FaultObservations    []ProbeObservation
	RecoveryObservations []ProbeObservation

	Baseline             map[string]interface{}
	baselineDistribution LatencyDistribution

	stopProbing chan struct{}
	probeWg     sync.WaitGroup
	mu          sync.Mutex
	probe       ChaosProbe

	expStart      float64
	baselineStart float64
	baselineEnd   float64
	faultStart    float64
	faultEnd      float64
	rollbackStart float64
	rollbackEnd   float64
	recoveryStart float64
	recoveryEnd   float64
	expEnd        float64
}

func NewSteadyStateEvaluator(probeURL string, expectedStatus int, containerName string, dm *docker.Manager) *SteadyStateEvaluator {
	if expectedStatus == 0 {
		expectedStatus = 200
	}
	return &SteadyStateEvaluator{
		ProbeURL:               probeURL,
		ExpectedStatus:         expectedStatus,
		BaselineProbeCount:     10,
		BaselineIntervalSec:    1.0,
		FaultProbeInterval:     1.0,
		RecoveryProbeInterval:  0.5,
		RecoveryConsecutiveReq: 3,
		DockerMgr:              dm,
		ContainerName:          containerName,
		stopProbing:            make(chan struct{}),
	}
}

func (e *SteadyStateEvaluator) MeasureBaseline(count int, interval float64) map[string]interface{} {
	if count <= 0 {
		count = e.BaselineProbeCount
	}
	if interval <= 0 {
		interval = e.BaselineIntervalSec
	}

	now := float64(time.Now().UnixNano()) / 1e9
	e.baselineStart = now
	if e.expStart == 0 {
		e.expStart = now
	}

	if e.ProbeURL == "" {
		e.baselineEnd = float64(time.Now().UnixNano()) / 1e9
		e.Baseline = map[string]interface{}{
			"status":               string(EvidenceStateInsufficientData),
			"available":            false,
			"sample_count":         0,
			"probes_count":         0,
			"healthy":              false,
			"availability_percent": nil,
			"avg_latency_ms":       nil,
			"raw_observations":     []interface{}{},
		}
		return e.Baseline
	}

	var validLatencies []float64
	successCount := 0
	var sampleErrors []string

	for i := 0; i < count; i++ {
		obs := e.probe.Probe(e.ProbeURL, 3.0, e.ExpectedStatus, PhaseBaseline, i)
		e.BaselineObservations = append(e.BaselineObservations, obs)
		if obs.Success {
			successCount++
			if obs.LatencyMs != nil {
				validLatencies = append(validLatencies, *obs.LatencyMs)
			}
		} else if obs.ErrorMessage != "" {
			sampleErrors = append(sampleErrors, obs.ErrorMessage)
		}
		if i < count-1 {
			time.Sleep(time.Duration(interval * float64(time.Second)))
		}
	}

	e.baselineEnd = float64(time.Now().UnixNano()) / 1e9
	e.baselineDistribution = computeDistribution(validLatencies)

	avail := 0.0
	if len(e.BaselineObservations) > 0 {
		avail = math.Round((float64(successCount)/float64(len(e.BaselineObservations)))*1000) / 10
	}

	st := string(EvidenceStatePartiallyMeasured)
	if len(e.BaselineObservations) >= 3 {
		st = string(EvidenceStateMeasured)
	}

	var statusCode interface{}
	for _, o := range e.BaselineObservations {
		if o.HTTPStatus != nil {
			statusCode = *o.HTTPStatus
			break
		}
	}

	e.Baseline = map[string]interface{}{
		"status":               st,
		"available":            successCount > 0,
		"probe_url":            e.ProbeURL,
		"sample_count":         len(e.BaselineObservations),
		"probes_count":         len(e.BaselineObservations),
		"healthy":              avail >= 66.0,
		"success_rate_percent": avail,
		"availability_percent": avail,
		"expected_status":      e.ExpectedStatus,
		"status_code":          statusCode,
		"sample_errors":        sampleErrors,
		"distribution":         e.baselineDistribution,
		"avg_latency_ms":       e.baselineDistribution.Mean,
		"p50_latency_ms":       e.baselineDistribution.P50,
		"p75_latency_ms":       e.baselineDistribution.P75,
		"p90_latency_ms":       e.baselineDistribution.P90,
		"p95_latency_ms":       e.baselineDistribution.P95,
		"p99_latency_ms":       e.baselineDistribution.P99,
		"min_latency_ms":       e.baselineDistribution.Min,
		"max_latency_ms":       e.baselineDistribution.Max,
		"stddev_latency_ms":    e.baselineDistribution.StdDev,
	}

	return e.Baseline
}

func (e *SteadyStateEvaluator) StartInFaultProbing(highResolutionInterval float64) {
	now := float64(time.Now().UnixNano()) / 1e9
	e.faultStart = now
	if e.expStart == 0 {
		e.expStart = now
	}

	if e.ProbeURL == "" {
		return
	}

	probeInterval := e.FaultProbeInterval
	if highResolutionInterval > 0 {
		probeInterval = highResolutionInterval
	}

	e.stopProbing = make(chan struct{})
	e.probeWg.Add(1)

	go func() {
		defer e.probeWg.Done()
		seq := 0
		ticker := time.NewTicker(time.Duration(probeInterval * float64(time.Second)))
		defer ticker.Stop()

		for {
			select {
			case <-e.stopProbing:
				return
			default:
				obs := e.probe.Probe(e.ProbeURL, 3.0, e.ExpectedStatus, PhaseFault, seq)
				seq++
				e.mu.Lock()
				e.FaultObservations = append(e.FaultObservations, obs)
				e.mu.Unlock()

				select {
				case <-e.stopProbing:
					return
				case <-ticker.C:
				}
			}
		}
	}()
}

func (e *SteadyStateEvaluator) StopInFaultProbing(faultWindowEnd float64) map[string]interface{} {
	if e.ProbeURL != "" {
		close(e.stopProbing)
		e.probeWg.Wait()
	}

	if faultWindowEnd > 0 {
		e.faultEnd = faultWindowEnd
	} else {
		e.faultEnd = float64(time.Now().UnixNano()) / 1e9
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	var validLatencies []float64
	successCount := 0
	spikeCount := 0
	maxConsecFails := 0
	curConsecFails := 0

	var baseMean float64
	if e.baselineDistribution.Mean != nil {
		baseMean = *e.baselineDistribution.Mean
	}

	for _, o := range e.FaultObservations {
		if o.Success {
			curConsecFails = 0
			successCount++
			if o.LatencyMs != nil {
				validLatencies = append(validLatencies, *o.LatencyMs)
				if baseMean > 0 && *o.LatencyMs > baseMean*2.0 {
					spikeCount++
				}
			}
		} else {
			curConsecFails++
			if curConsecFails > maxConsecFails {
				maxConsecFails = curConsecFails
			}
		}
	}

	dist := computeDistribution(validLatencies)
	sampleCount := len(e.FaultObservations)

	var avail *float64
	if sampleCount > 0 {
		av := math.Round((float64(successCount)/float64(sampleCount))*1000) / 10
		avail = &av
	}

	var mult *float64
	var pctDelta *float64
	if dist.Mean != nil && baseMean > 0 {
		m := math.Round((*dist.Mean/baseMean)*100) / 100
		mult = &m
		pd := math.Round(((*dist.Mean-baseMean)/baseMean)*1000) / 10
		pctDelta = &pd
	}

	faultDur := e.faultEnd - e.faultStart
	underSampled := (faultDur < 1.0) || (sampleCount < 2)

	return map[string]interface{}{
		"probes_count":         sampleCount,
		"successful_probes":    successCount,
		"failed_probes":        sampleCount - successCount,
		"availability_percent": avail,
		"latency_distribution": dist,
		"avg_latency_ms":       dist.Mean,
		"p95_latency_ms":       dist.P95,
		"p99_latency_ms":       dist.P99,
		"latency_multiplier":   mult,
		"baseline_comparison": map[string]interface{}{
			"percentage_delta":  pctDelta,
			"ratio_to_baseline": mult,
		},
		"anomaly_summary": map[string]interface{}{
			"spike_count":               spikeCount,
			"max_consecutive_failures": maxConsecFails,
		},
		"observability_coverage": map[string]interface{}{
			"under_sampled": underSampled,
			"warning": func() interface{} {
				if underSampled {
					return "Transient outage may be under-sampled. Fault duration was short relative to probe interval."
				}
				return nil
			}(),
		},
	}
}

func (e *SteadyStateEvaluator) MeasureRecovery(maxWaitSec, rtoTargetSec float64) map[string]interface{} {
	e.recoveryStart = float64(time.Now().UnixNano()) / 1e9

	if e.ProbeURL == "" {
		e.recoveryEnd = float64(time.Now().UnixNano()) / 1e9
		return map[string]interface{}{
			"status":                 "INCONCLUSIVE",
			"recovered":              nil,
			"recovery_time_seconds":  nil,
			"rto_seconds":            nil,
			"rto_target_seconds":     rtoTargetSec,
			"rto_target_met":         nil,
			"recovery_probe_count":   0,
			"timed_out":              false,
			"reason":                 "No probe URL configured.",
		}
	}

	timeoutCh := time.After(time.Duration(maxWaitSec * float64(time.Second)))
	ticker := time.NewTicker(time.Duration(e.RecoveryProbeInterval * float64(time.Second)))
	defer ticker.Stop()

	consecutiveSuccesses := 0
	seq := 0
	var firstSuccessTs float64

	for {
		select {
		case <-timeoutCh:
			e.recoveryEnd = float64(time.Now().UnixNano()) / 1e9
			return map[string]interface{}{
				"status":               "FAILED",
				"recovered":            false,
				"recovery_time_seconds": maxWaitSec,
				"rto_seconds":          maxWaitSec,
				"rto_target_seconds":   rtoTargetSec,
				"rto_target_met":       false,
				"recovery_probe_count": len(e.RecoveryObservations),
				"timed_out":            true,
			}
		case <-ticker.C:
			obs := e.probe.Probe(e.ProbeURL, 3.0, e.ExpectedStatus, PhaseRecovery, seq)
			seq++
			e.RecoveryObservations = append(e.RecoveryObservations, obs)

			if obs.Success {
				if consecutiveSuccesses == 0 {
					firstSuccessTs = obs.Timestamp
				}
				consecutiveSuccesses++
				if consecutiveSuccesses >= e.RecoveryConsecutiveReq {
					e.recoveryEnd = float64(time.Now().UnixNano()) / 1e9
					rto := math.Round((firstSuccessTs-e.faultEnd)*1000) / 1000
					if rto < 0.05 {
						rto = 0.05
					}
					targetMet := rto <= rtoTargetSec
					return map[string]interface{}{
						"status":                 "RECOVERED",
						"recovered":              true,
						"recovery_time_seconds":  rto,
						"rto_seconds":            rto,
						"rto_target_seconds":     rtoTargetSec,
						"rto_target_met":         targetMet,
						"recovery_probe_count":   len(e.RecoveryObservations),
						"timed_out":              false,
					}
				}
			} else {
				consecutiveSuccesses = 0
			}
		}
	}
}

func (e *SteadyStateEvaluator) LifecycleTimestamps() map[string]interface{} {
	e.expEnd = float64(time.Now().UnixNano()) / 1e9
	totalDur := math.Round((e.expEnd-e.expStart)*1000) / 1000
	faultDur := math.Round((e.faultEnd-e.faultStart)*1000) / 1000

	var recDur *float64
	if e.recoveryEnd > e.recoveryStart {
		rd := math.Round((e.recoveryEnd-e.recoveryStart)*1000) / 1000
		recDur = &rd
	}

	return map[string]interface{}{
		"experiment_started_at":             e.expStart,
		"fault_window_start":                e.faultStart,
		"fault_window_end":                  e.faultEnd,
		"fault_window_duration_seconds":     faultDur,
		"recovery_duration_seconds":         recDur,
		"total_experiment_duration_seconds": totalDur,
	}
}

func (e *SteadyStateEvaluator) AllRawObservations() map[string]interface{} {
	return map[string]interface{}{
		"baseline":    e.BaselineObservations,
		"fault":       e.FaultObservations,
		"recovery":    e.RecoveryObservations,
		"total_count": len(e.BaselineObservations) + len(e.FaultObservations) + len(e.RecoveryObservations),
	}
}

type ResilienceScorer struct{}

func (rs *ResilienceScorer) CalculateScore(
	faultType string,
	baseline map[string]interface{},
	expMetrics map[string]interface{},
	recoveryMetrics map[string]interface{},
	rollbackSuccess bool,
) map[string]interface{} {
	if expMetrics == nil {
		expMetrics = make(map[string]interface{})
	}
	if recoveryMetrics == nil {
		recoveryMetrics = make(map[string]interface{})
	}
	if baseline == nil {
		baseline = make(map[string]interface{})
	}

	probesCount, _ := expMetrics["probes_count"].(int)
	availBool, _ := baseline["available"].(bool)
	hasProbe := availBool && probesCount > 0

	// Measurement Quality Score (0-100)
	qualityScore := 0
	baseCount, _ := baseline["sample_count"].(int)
	if baseCount >= 10 {
		qualityScore += 25
	} else if baseCount >= 5 {
		qualityScore += 18
	} else if baseCount >= 1 {
		qualityScore += 10
	}

	cov, _ := expMetrics["observability_coverage"].(map[string]interface{})
	underSampled := false
	if cov != nil {
		underSampled, _ = cov["under_sampled"].(bool)
	}

	if !underSampled && probesCount >= 20 {
		qualityScore += 35
	} else if !underSampled && probesCount >= 10 {
		qualityScore += 28
	} else if probesCount >= 3 {
		qualityScore += 15
	} else if probesCount >= 1 {
		qualityScore += 5
	}

	recCount, _ := recoveryMetrics["recovery_probe_count"].(int)
	if recCount >= 3 {
		qualityScore += 20
	} else if recCount >= 1 {
		qualityScore += 10
	}

	if probesCount >= 10 {
		qualityScore += 10
	}

	qualityGrade := "ADEQUATE"
	if qualityScore >= 85 {
		qualityGrade = "EXCELLENT"
	} else if qualityScore >= 70 {
		qualityGrade = "GOOD"
	} else if qualityScore < 50 {
		qualityGrade = "INSUFFICIENT"
	}

	// Evidence sufficiency gate
	if !hasProbe || probesCount == 0 {
		return map[string]interface{}{
			"score":                      nil,
			"grade":                      "INCONCLUSIVE",
			"classification":             "INCONCLUSIVE (Insufficient Evidence)",
			"has_probe":                  false,
			"evidence_state":             string(EvidenceStateInsufficientData),
			"confidence":                 "inconclusive",
			"measurement_quality_score":  qualityScore,
			"measurement_quality_grade":  qualityGrade,
			"recommendations": []string{
				"Configure an active HTTP probe endpoint (--probe-url) to collect real-time steady-state measurements.",
				"Verify target container is reachable before running fault injection.",
			},
		}
	}

	// Calculate Score Components
	// 1. Availability (30 pts)
	availScore := 0.0
	var avVal *float64
	if av, ok := expMetrics["availability_percent"].(*float64); ok && av != nil {
		avVal = av
	} else if av, ok := expMetrics["availability_percent"].(float64); ok {
		avVal = &av
	}
	if avVal != nil {
		availScore = math.Round((*avVal/100.0)*30*10) / 10
	}

	// 2. Latency Degradation (20 pts)
	latScore := 10.0
	var multVal *float64
	if mult, ok := expMetrics["latency_multiplier"].(*float64); ok && mult != nil {
		multVal = mult
	} else if mult, ok := expMetrics["latency_multiplier"].(float64); ok {
		multVal = &mult
	}
	if multVal != nil {
		if *multVal <= 1.15 {
			latScore = 20.0
		} else if *multVal <= 1.5 {
			latScore = 17.0
		} else if *multVal <= 2.0 {
			latScore = 13.0
		} else if *multVal <= 3.0 {
			latScore = 8.0
		} else {
			latScore = 4.0
		}
	}

	// 3. Tail Latency (10 pts)
	tailScore := 5.0
	if dist, ok := expMetrics["latency_distribution"].(LatencyDistribution); ok && dist.P95 != nil {
		tailScore = 8.0
	}

	// 4. Recovery / RTO (25 pts)
	recScore := 10.0
	if recOk, ok := recoveryMetrics["recovered"].(bool); ok {
		if !recOk {
			recScore = 0.0
		} else {
			var rtoVal *float64
			if rto, ok := recoveryMetrics["rto_seconds"].(float64); ok {
				rtoVal = &rto
			} else if rto, ok := recoveryMetrics["rto_seconds"].(*float64); ok && rto != nil {
				rtoVal = rto
			} else if rto, ok := recoveryMetrics["recovery_time_seconds"].(float64); ok {
				rtoVal = &rto
			} else if rto, ok := recoveryMetrics["recovery_time_seconds"].(*float64); ok && rto != nil {
				rtoVal = rto
			}
			if rtoVal != nil {
				if *rtoVal <= 1.0 {
					recScore = 25.0
				} else if *rtoVal <= 3.0 {
					recScore = 20.0
				} else if *rtoVal <= 5.0 {
					recScore = 15.0
				} else {
					recScore = 8.0
				}
			}
		}
	}

	// 5. Rollback (10 pts)
	rollbackScore := 0.0
	if rollbackSuccess {
		rollbackScore = 10.0
	}

	// 6. Stability (5 pts)
	stabilityScore := 5.0

	rawTotal := availScore + latScore + tailScore + recScore + rollbackScore + stabilityScore
	finalScore := int(math.Round(rawTotal))
	if finalScore > 100 {
		finalScore = 100
	}
	if finalScore < 0 {
		finalScore = 0
	}

	grade := "F"
	classification := "Fragile / High Risk"
	if finalScore >= 90 {
		grade = "A"
		classification = "Resilient (Production Grade)"
	} else if finalScore >= 75 {
		grade = "B"
		classification = "Gracefully Degraded"
	} else if finalScore >= 50 {
		grade = "C"
		classification = "Vulnerable"
	}

	var recs []string
	if finalScore < 90 {
		recs = append(recs, "Deploy multiple service replicas with active health checks and load balancing.")
		recs = append(recs, "Configure explicit client timeouts with bounded exponential backoff and jitter.")
	}
	if faultType == "cpu_stress" || faultType == "memory_stress" {
		recs = append(recs, "Define explicit CPU and memory cgroup limits in docker-compose.yml to prevent node starvation.")
	}
	if len(recs) == 0 {
		recs = append(recs, "System maintained excellent resilience under fault injection.")
	}

	return map[string]interface{}{
		"score":                     finalScore,
		"grade":                     grade,
		"classification":            classification,
		"has_probe":                 true,
		"evidence_state":            string(EvidenceStateMeasured),
		"confidence":                "high",
		"measurement_quality_score": qualityScore,
		"measurement_quality_grade": qualityGrade,
		"breakdown": map[string]interface{}{
			"availability":        availScore,
			"latency_degradation": latScore,
			"tail_latency":        tailScore,
			"recovery":            recScore,
			"rollback":            rollbackScore,
			"stability":           stabilityScore,
		},
		"recommendations": recs,
	}
}
