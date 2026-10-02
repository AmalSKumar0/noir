package executors

import (
	"fmt"
	"time"

	"noir-cli/internal/docker"
	"noir-cli/internal/faults/types"
)

type ContainerRestartExecutor struct{}

func (e *ContainerRestartExecutor) Name() string                     { return "container_restart" }
func (e *ContainerRestartExecutor) DisplayName() string              { return "Container Restart" }
func (e *ContainerRestartExecutor) Description() string              { return "Gracefully stops and restarts the target container to test system recovery and reconnection." }
func (e *ContainerRestartExecutor) RequiresActiveContainer() bool   { return true }

func (e *ContainerRestartExecutor) ValidateParameters(params map[string]interface{}) (map[string]interface{}, error) {
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
		"timeout": timeout,
	}, nil
}

func (e *ContainerRestartExecutor) Execute(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *types.ExecutionContext) (*types.FaultResult, error) {
	valParams, err := e.ValidateParameters(params)
	if err != nil {
		return nil, err
	}
	timeout := valParams["timeout"].(int)

	t0 := time.Now()
	res, err := dm.RestartContainer(containerName, timeout)
	duration := time.Since(t0).Seconds()

	if err != nil {
		return &types.FaultResult{
			Success:         false,
			Message:         fmt.Sprintf("Failed to restart container '%s': %v", containerName, err),
			Details:         map[string]interface{}{"target": containerName, "error": err.Error()},
			DurationSeconds: duration,
			Recovered:       false,
			Error:           err.Error(),
		}, nil
	}

	isRunning, _ := res["running"].(bool)
	if isRunning {
		return &types.FaultResult{
			Success:         true,
			Message:         fmt.Sprintf("Container '%s' restarted in %.2fs (Docker lifecycle verified).", containerName, duration),
			Details:         res,
			DurationSeconds: duration,
			Recovered:       true,
		}, nil
	}

	return &types.FaultResult{
		Success:         false,
		Message:         fmt.Sprintf("Container '%s' failed to resume running state after restart.", containerName),
		Details:         res,
		DurationSeconds: duration,
		Recovered:       false,
		Error:           "Container status is not running.",
	}, nil
}

func (e *ContainerRestartExecutor) Rollback(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *types.ExecutionContext) bool {
	info, err := dm.GetContainerInfo(containerName)
	if err == nil && !info.Running {
		_ = dm.StartContainer(containerName)
	}
	return true
}
