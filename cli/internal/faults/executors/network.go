package executors

import (
	"fmt"
	"time"

	"noir-cli/internal/docker"
	"noir-cli/internal/faults/types"
)

type NetworkDelayExecutor struct{}

func (e *NetworkDelayExecutor) Name() string                     { return "network_delay" }
func (e *NetworkDelayExecutor) DisplayName() string              { return "Network Latency / Delay" }
func (e *NetworkDelayExecutor) Description() string              { return "Injects artificial network packet latency (with optional jitter) into container network interface using Linux Traffic Control." }
func (e *NetworkDelayExecutor) RequiresActiveContainer() bool   { return true }

func (e *NetworkDelayExecutor) ValidateParameters(params map[string]interface{}) (map[string]interface{}, error) {
	latency := 500
	if raw, ok := params["latency_ms"]; ok {
		switch v := raw.(type) {
		case int:
			latency = v
		case float64:
			latency = int(v)
		}
	}
	if latency < 1 || latency > 5000 {
		return nil, fmt.Errorf("latency_ms must be between 1 and 5000 milliseconds")
	}

	jitter := 50
	if raw, ok := params["jitter_ms"]; ok {
		switch v := raw.(type) {
		case int:
			jitter = v
		case float64:
			jitter = int(v)
		}
	}
	if jitter < 0 || jitter > 1000 {
		return nil, fmt.Errorf("jitter_ms must be between 0 and 1000 milliseconds")
	}

	duration := 10
	if raw, ok := params["duration"]; ok {
		switch v := raw.(type) {
		case int:
			duration = v
		case float64:
			duration = int(v)
		}
	}
	if duration < 1 || duration > 300 {
		return nil, fmt.Errorf("duration must be between 1 and 300 seconds")
	}

	iface := "eth0"
	if raw, ok := params["interface"].(string); ok && raw != "" {
		iface = raw
	}

	return map[string]interface{}{
		"latency_ms": latency,
		"jitter_ms":  jitter,
		"duration":   duration,
		"interface":  iface,
	}, nil
}

func (e *NetworkDelayExecutor) Execute(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *types.ExecutionContext) (*types.FaultResult, error) {
	valParams, err := e.ValidateParameters(params)
	if err != nil {
		return nil, err
	}
	latencyMs := valParams["latency_ms"].(int)
	jitterMs := valParams["jitter_ms"].(int)
	duration := valParams["duration"].(int)
	iface := valParams["interface"].(string)

	t0 := time.Now()
	if ctx != nil && ctx.Log != nil {
		ctx.Log(fmt.Sprintf("Applying network delay %dms (jitter ±%dms) on %s...", latencyMs, jitterMs, iface), "INFO")
	}

	if err := dm.ApplyNetworkDelay(containerName, latencyMs, jitterMs, iface); err != nil {
		return &types.FaultResult{
			Success:         false,
			Message:         fmt.Sprintf("Failed to apply network delay on container '%s': %v", containerName, err),
			Details:         map[string]interface{}{"target": containerName, "error": err.Error()},
			DurationSeconds: time.Since(t0).Seconds(),
			Recovered:       false,
			Error:           err.Error(),
		}, nil
	}

	step := 250 * time.Millisecond
	loops := int(float64(duration) / 0.25)
	for i := 0; i < loops; i++ {
		if ctx != nil && ctx.IsCancelled != nil && ctx.IsCancelled() {
			e.Rollback(dm, containerName, params, ctx)
			if ctx.Log != nil {
				ctx.Log(fmt.Sprintf("Execution cancelled by user. Removed network delay on '%s'.", containerName), "WARN")
			}
			return &types.FaultResult{
				Success:         false,
				Message:         fmt.Sprintf("Network delay on '%s' cancelled by user.", containerName),
				Details:         map[string]interface{}{"target": containerName, "cancelled": true},
				DurationSeconds: time.Since(t0).Seconds(),
				Recovered:       true,
				Error:           "Cancelled by user.",
			}, nil
		}
		time.Sleep(step)
		if ctx != nil && ctx.Log != nil && (i+1)%8 == 0 {
			elapsedSec := int(float64(i+1) * 0.25)
			ctx.Log(fmt.Sprintf("Network latency active: +%dms on %s (%ds / %ds)", latencyMs, containerName, elapsedSec, duration), "INFO")
		}
	}

	_ = dm.RemoveNetworkDelay(containerName, iface)
	if ctx != nil && ctx.Log != nil {
		ctx.Log(fmt.Sprintf("Cleaned up network delay on '%s'. Restored normal traffic.", containerName), "INFO")
	}

	elapsed := time.Since(t0).Seconds()
	return &types.FaultResult{
		Success:         true,
		Message:         fmt.Sprintf("Injected %dms delay (±%dms) on '%s' for %ds. Network restored.", latencyMs, jitterMs, containerName, duration),
		Details:         map[string]interface{}{"target": containerName, "latency_ms": latencyMs, "jitter_ms": jitterMs, "duration_seconds": duration, "interface": iface},
		DurationSeconds: elapsed,
		Recovered:       true,
	}, nil
}

func (e *NetworkDelayExecutor) Rollback(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *types.ExecutionContext) bool {
	iface := "eth0"
	if raw, ok := params["interface"].(string); ok && raw != "" {
		iface = raw
	}
	_ = dm.RemoveNetworkDelay(containerName, iface)
	return true
}

type NetworkLossExecutor struct{}

func (e *NetworkLossExecutor) Name() string                     { return "network_loss" }
func (e *NetworkLossExecutor) DisplayName() string              { return "Packet Loss" }
func (e *NetworkLossExecutor) Description() string              { return "Simulates packet loss on the container's network interface using Linux Traffic Control netem." }
func (e *NetworkLossExecutor) RequiresActiveContainer() bool   { return true }

func (e *NetworkLossExecutor) ValidateParameters(params map[string]interface{}) (map[string]interface{}, error) {
	loss := 20.0
	if raw, ok := params["loss_percent"]; ok {
		switch v := raw.(type) {
		case float64:
			loss = v
		case int:
			loss = float64(v)
		}
	}
	if loss <= 0.0 || loss > 100.0 {
		return nil, fmt.Errorf("loss_percent must be between 0.1 and 100.0 percent")
	}

	duration := 10
	if raw, ok := params["duration"]; ok {
		switch v := raw.(type) {
		case int:
			duration = v
		case float64:
			duration = int(v)
		}
	}
	if duration < 1 || duration > 300 {
		return nil, fmt.Errorf("duration must be between 1 and 300 seconds")
	}

	iface := "eth0"
	if raw, ok := params["interface"].(string); ok && raw != "" {
		iface = raw
	}

	return map[string]interface{}{
		"loss_percent": loss,
		"duration":     duration,
		"interface":    iface,
	}, nil
}

func (e *NetworkLossExecutor) Execute(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *types.ExecutionContext) (*types.FaultResult, error) {
	valParams, err := e.ValidateParameters(params)
	if err != nil {
		return nil, err
	}
	lossPercent := valParams["loss_percent"].(float64)
	duration := valParams["duration"].(int)
	iface := valParams["interface"].(string)

	t0 := time.Now()
	if ctx != nil && ctx.Log != nil {
		ctx.Log(fmt.Sprintf("Applying packet loss %.1f%% on %s...", lossPercent, iface), "INFO")
	}

	if err := dm.ApplyNetworkLoss(containerName, lossPercent, iface); err != nil {
		return &types.FaultResult{
			Success:         false,
			Message:         fmt.Sprintf("Failed to apply packet loss on container '%s': %v", containerName, err),
			Details:         map[string]interface{}{"target": containerName, "error": err.Error()},
			DurationSeconds: time.Since(t0).Seconds(),
			Recovered:       false,
			Error:           err.Error(),
		}, nil
	}

	step := 250 * time.Millisecond
	loops := int(float64(duration) / 0.25)
	for i := 0; i < loops; i++ {
		if ctx != nil && ctx.IsCancelled != nil && ctx.IsCancelled() {
			e.Rollback(dm, containerName, params, ctx)
			if ctx.Log != nil {
				ctx.Log(fmt.Sprintf("Execution cancelled by user. Removed packet loss on '%s'.", containerName), "WARN")
			}
			return &types.FaultResult{
				Success:         false,
				Message:         fmt.Sprintf("Packet loss on '%s' cancelled by user.", containerName),
				Details:         map[string]interface{}{"target": containerName, "cancelled": true},
				DurationSeconds: time.Since(t0).Seconds(),
				Recovered:       true,
				Error:           "Cancelled by user.",
			}, nil
		}
		time.Sleep(step)
		if ctx != nil && ctx.Log != nil && (i+1)%8 == 0 {
			elapsedSec := int(float64(i+1) * 0.25)
			ctx.Log(fmt.Sprintf("Packet loss active: %.1f%% on %s (%ds / %ds)", lossPercent, containerName, elapsedSec, duration), "INFO")
		}
	}

	_ = dm.RemoveNetworkDelay(containerName, iface)
	if ctx != nil && ctx.Log != nil {
		ctx.Log(fmt.Sprintf("Cleaned up packet loss on '%s'. Restored normal traffic.", containerName), "INFO")
	}

	elapsed := time.Since(t0).Seconds()
	return &types.FaultResult{
		Success:         true,
		Message:         fmt.Sprintf("Injected %.1f%% packet loss on '%s' for %ds. Network restored.", lossPercent, containerName, duration),
		Details:         map[string]interface{}{"target": containerName, "loss_percent": lossPercent, "duration_seconds": duration, "interface": iface},
		DurationSeconds: elapsed,
		Recovered:       true,
	}, nil
}

func (e *NetworkLossExecutor) Rollback(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *types.ExecutionContext) bool {
	iface := "eth0"
	if raw, ok := params["interface"].(string); ok && raw != "" {
		iface = raw
	}
	_ = dm.RemoveNetworkDelay(containerName, iface)
	return true
}
