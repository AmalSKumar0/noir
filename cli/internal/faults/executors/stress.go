package executors

import (
	"context"
	"fmt"
	"time"

	"noir-cli/internal/docker"
	"noir-cli/internal/faults/types"
)

type CpuStressExecutor struct{}

func (e *CpuStressExecutor) Name() string                     { return "cpu_stress" }
func (e *CpuStressExecutor) DisplayName() string              { return "CPU Stress / Load" }
func (e *CpuStressExecutor) Description() string              { return "Simulates high CPU utilization inside container using worker processes for a bounded duration." }
func (e *CpuStressExecutor) RequiresActiveContainer() bool   { return true }

func (e *CpuStressExecutor) ValidateParameters(params map[string]interface{}) (map[string]interface{}, error) {
	workers := 2
	if raw, ok := params["workers"]; ok {
		switch v := raw.(type) {
		case int:
			workers = v
		case float64:
			workers = int(v)
		}
	}
	if workers < 1 || workers > 16 {
		return nil, fmt.Errorf("workers must be between 1 and 16")
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

	return map[string]interface{}{
		"workers":  workers,
		"duration": duration,
	}, nil
}

func (e *CpuStressExecutor) Execute(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *types.ExecutionContext) (*types.FaultResult, error) {
	valParams, err := e.ValidateParameters(params)
	if err != nil {
		return nil, err
	}
	workers := valParams["workers"].(int)
	duration := valParams["duration"].(int)

	t0 := time.Now()
	if ctx != nil && ctx.Log != nil {
		ctx.Log(fmt.Sprintf("Applying CPU stress (%d workers) on '%s' for %ds...", workers, containerName, duration), "INFO")
	}

	type runRes struct {
		code int
		out  string
		err  error
	}
	doneCh := make(chan runRes, 1)

	go func() {
		code, out, err := dm.ApplyCpuStress(context.Background(), containerName, workers, duration)
		doneCh <- runRes{code: code, out: out, err: err}
	}()

	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	lastLog := 0

	for {
		select {
		case r := <-doneCh:
			elapsed := time.Since(t0).Seconds()
			if r.err != nil {
				dm.KillFaultProcesses(containerName)
				return &types.FaultResult{
					Success:         false,
					Message:         fmt.Sprintf("CPU stress failed on '%s': %v", containerName, r.err),
					Details:         map[string]interface{}{"target": containerName, "error": r.err.Error()},
					DurationSeconds: elapsed,
					Recovered:       true,
					Error:           r.err.Error(),
				}, nil
			}
			if ctx != nil && ctx.Log != nil {
				ctx.Log(fmt.Sprintf("CPU stress completed successfully on '%s' (%.2fs).", containerName, elapsed), "INFO")
			}
			return &types.FaultResult{
				Success:         true,
				Message:         fmt.Sprintf("Applied CPU stress with %d worker(s) on '%s' for %ds.", workers, containerName, duration),
				Details:         map[string]interface{}{"target": containerName, "workers": workers, "duration_seconds": duration, "exit_code": r.code},
				DurationSeconds: elapsed,
				Recovered:       true,
			}, nil
		case <-ticker.C:
			if ctx != nil && ctx.IsCancelled != nil && ctx.IsCancelled() {
				dm.KillFaultProcesses(containerName)
				if ctx.Log != nil {
					ctx.Log(fmt.Sprintf("Execution cancelled by user. Terminated CPU stress processes in '%s'.", containerName), "WARN")
				}
				return &types.FaultResult{
					Success:         false,
					Message:         fmt.Sprintf("CPU stress on '%s' cancelled by user.", containerName),
					Details:         map[string]interface{}{"target": containerName, "cancelled": true},
					DurationSeconds: time.Since(t0).Seconds(),
					Recovered:       true,
					Error:           "Cancelled by user.",
				}, nil
			}
			elapsedSec := int(time.Since(t0).Seconds())
			if ctx != nil && ctx.Log != nil && elapsedSec > 0 && elapsedSec%3 == 0 && elapsedSec != lastLog {
				lastLog = elapsedSec
				ctx.Log(fmt.Sprintf("CPU stress active on '%s' (%ds / %ds)...", containerName, elapsedSec, duration), "INFO")
			}
		}
	}
}

func (e *CpuStressExecutor) Rollback(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *types.ExecutionContext) bool {
	dm.KillFaultProcesses(containerName)
	return true
}

type MemoryStressExecutor struct{}

func (e *MemoryStressExecutor) Name() string                     { return "memory_stress" }
func (e *MemoryStressExecutor) DisplayName() string              { return "Memory Stress / Pressure" }
func (e *MemoryStressExecutor) Description() string              { return "Simulates memory pressure by allocating a designated buffer inside the container for a bounded duration." }
func (e *MemoryStressExecutor) RequiresActiveContainer() bool   { return true }

func (e *MemoryStressExecutor) ValidateParameters(params map[string]interface{}) (map[string]interface{}, error) {
	memoryMB := 256
	if raw, ok := params["memory_mb"]; ok {
		switch v := raw.(type) {
		case int:
			memoryMB = v
		case float64:
			memoryMB = int(v)
		}
	}
	if memoryMB < 16 || memoryMB > 4096 {
		return nil, fmt.Errorf("memory_mb must be between 16 and 4096 MB")
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

	return map[string]interface{}{
		"memory_mb": memoryMB,
		"duration":  duration,
	}, nil
}

func (e *MemoryStressExecutor) Execute(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *types.ExecutionContext) (*types.FaultResult, error) {
	valParams, err := e.ValidateParameters(params)
	if err != nil {
		return nil, err
	}
	memoryMB := valParams["memory_mb"].(int)
	duration := valParams["duration"].(int)

	t0 := time.Now()
	if ctx != nil && ctx.Log != nil {
		ctx.Log(fmt.Sprintf("Applying memory pressure (%dMB) on '%s' for %ds...", memoryMB, containerName, duration), "INFO")
	}

	type runRes struct {
		code int
		out  string
		err  error
	}
	doneCh := make(chan runRes, 1)

	go func() {
		code, out, err := dm.ApplyMemoryStress(context.Background(), containerName, memoryMB, duration)
		doneCh <- runRes{code: code, out: out, err: err}
	}()

	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	lastLog := 0

	for {
		select {
		case r := <-doneCh:
			elapsed := time.Since(t0).Seconds()
			if r.err != nil {
				dm.KillFaultProcesses(containerName)
				return &types.FaultResult{
					Success:         false,
					Message:         fmt.Sprintf("Memory stress failed on '%s': %v", containerName, r.err),
					Details:         map[string]interface{}{"target": containerName, "error": r.err.Error()},
					DurationSeconds: elapsed,
					Recovered:       true,
					Error:           r.err.Error(),
				}, nil
			}
			if ctx != nil && ctx.Log != nil {
				ctx.Log(fmt.Sprintf("Memory pressure completed successfully on '%s' (%.2fs).", containerName, elapsed), "INFO")
			}
			return &types.FaultResult{
				Success:         true,
				Message:         fmt.Sprintf("Applied memory pressure (%dMB) on '%s' for %ds.", memoryMB, containerName, duration),
				Details:         map[string]interface{}{"target": containerName, "memory_mb": memoryMB, "duration_seconds": duration, "exit_code": r.code},
				DurationSeconds: elapsed,
				Recovered:       true,
			}, nil
		case <-ticker.C:
			if ctx != nil && ctx.IsCancelled != nil && ctx.IsCancelled() {
				dm.KillFaultProcesses(containerName)
				if ctx.Log != nil {
					ctx.Log(fmt.Sprintf("Execution cancelled by user. Terminated memory stress processes in '%s'.", containerName), "WARN")
				}
				return &types.FaultResult{
					Success:         false,
					Message:         fmt.Sprintf("Memory stress on '%s' cancelled by user.", containerName),
					Details:         map[string]interface{}{"target": containerName, "cancelled": true},
					DurationSeconds: time.Since(t0).Seconds(),
					Recovered:       true,
					Error:           "Cancelled by user.",
				}, nil
			}
			elapsedSec := int(time.Since(t0).Seconds())
			if ctx != nil && ctx.Log != nil && elapsedSec > 0 && elapsedSec%3 == 0 && elapsedSec != lastLog {
				lastLog = elapsedSec
				ctx.Log(fmt.Sprintf("Memory stress active on '%s' (%ds / %ds)...", containerName, elapsedSec, duration), "INFO")
			}
		}
	}
}

func (e *MemoryStressExecutor) Rollback(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *types.ExecutionContext) bool {
	dm.KillFaultProcesses(containerName)
	return true
}
