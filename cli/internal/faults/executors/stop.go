package executors

import (
	"fmt"
	"time"

	"noir-cli/internal/docker"
	"noir-cli/internal/faults/types"
)

type ContainerStopExecutor struct{}

func (e *ContainerStopExecutor) Name() string                     { return "container_stop" }
func (e *ContainerStopExecutor) DisplayName() string              { return "Container Stop" }
func (e *ContainerStopExecutor) Description() string              { return "Stops the target container for a configured duration, then automatically restarts it to verify fault recovery." }
func (e *ContainerStopExecutor) RequiresActiveContainer() bool   { return true }

func (e *ContainerStopExecutor) ValidateParameters(params map[string]interface{}) (map[string]interface{}, error) {
	duration := 15
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

	timeout := 10
	if raw, ok := params["timeout"]; ok {
		switch v := raw.(type) {
		case int:
			timeout = v
		case float64:
			timeout = int(v)
		}
	}
	if timeout < 1 || timeout > 60 {
		return nil, fmt.Errorf("timeout must be between 1 and 60 seconds")
	}

	return map[string]interface{}{
		"duration": duration,
		"timeout":  timeout,
	}, nil
}

func (e *ContainerStopExecutor) Execute(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *types.ExecutionContext) (*types.FaultResult, error) {
	valParams, err := e.ValidateParameters(params)
	if err != nil {
		return nil, err
	}
	duration := valParams["duration"].(int)
	timeout := valParams["timeout"].(int)

	t0 := time.Now()
	if ctx != nil && ctx.Log != nil {
		ctx.Log(fmt.Sprintf("Stopping container '%s' (timeout: %ds)...", containerName, timeout), "INFO")
	}

	if err := dm.StopContainer(containerName, timeout); err != nil {
		return &types.FaultResult{
			Success:         false,
			Message:         fmt.Sprintf("Error stopping container '%s': %v", containerName, err),
			Details:         map[string]interface{}{"target": containerName, "error": err.Error()},
			DurationSeconds: time.Since(t0).Seconds(),
			Recovered:       false,
			Error:           err.Error(),
		}, nil
	}

	if ctx != nil && ctx.Log != nil {
		ctx.Log(fmt.Sprintf("Container '%s' stopped. Holding offline state for %ds...", containerName, duration), "INFO")
	}

	// Hold stopped state with cancellation checks
	step := 250 * time.Millisecond
	totalLoops := int(float64(duration) / 0.25)
	for i := 0; i < totalLoops; i++ {
		if ctx != nil && ctx.IsCancelled != nil && ctx.IsCancelled() {
			e.Rollback(dm, containerName, params, ctx)
			if ctx.Log != nil {
				ctx.Log(fmt.Sprintf("Execution cancelled by user. Restarted container '%s'.", containerName), "WARN")
			}
			return &types.FaultResult{
				Success:         false,
				Message:         fmt.Sprintf("Container stop on '%s' cancelled by user.", containerName),
				Details:         map[string]interface{}{"target": containerName, "cancelled": true},
				DurationSeconds: time.Since(t0).Seconds(),
				Recovered:       true,
				Error:           "Cancelled by user.",
			}, nil
		}
		time.Sleep(step)
		if ctx != nil && ctx.Log != nil && (i+1)%8 == 0 {
			elapsedSec := int(float64(i+1) * 0.25)
			ctx.Log(fmt.Sprintf("Container offline: '%s' (%ds / %ds)", containerName, elapsedSec, duration), "INFO")
		}
	}

	if ctx != nil && ctx.Log != nil {
		ctx.Log(fmt.Sprintf("Holding duration complete. Recovering and starting container '%s'...", containerName), "INFO")
	}

	if err := dm.StartContainer(containerName); err != nil {
		return &types.FaultResult{
			Success:         false,
			Message:         fmt.Sprintf("Container '%s' failed to restart after %ds stop period.", containerName, duration),
			Details:         map[string]interface{}{"target": containerName, "error": err.Error()},
			DurationSeconds: time.Since(t0).Seconds(),
			Recovered:       false,
			Error:           err.Error(),
		}, nil
	}

	elapsed := time.Since(t0).Seconds()
	if ctx != nil && ctx.Log != nil {
		ctx.Log(fmt.Sprintf("Container '%s' restarted and healthy.", containerName), "INFO")
	}

	return &types.FaultResult{
		Success:         true,
		Message:         fmt.Sprintf("Container '%s' successfully stopped for %ds and recovered.", containerName, duration),
		Details:         map[string]interface{}{"target": containerName, "stopped_duration_seconds": duration, "total_duration_seconds": elapsed, "status": "running"},
		DurationSeconds: elapsed,
		Recovered:       true,
	}, nil
}

func (e *ContainerStopExecutor) Rollback(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *types.ExecutionContext) bool {
	info, err := dm.GetContainerInfo(containerName)
	if err == nil && !info.Running {
		_ = dm.StartContainer(containerName)
	}
	return true
}
