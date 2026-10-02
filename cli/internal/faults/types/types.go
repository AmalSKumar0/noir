package types

import (
	"noir-cli/internal/docker"
)

type FaultResult struct {
	Success         bool                   `json:"success"`
	Message         string                 `json:"message"`
	Details         map[string]interface{} `json:"details"`
	DurationSeconds float64                `json:"duration_seconds"`
	Recovered       bool                   `json:"recovered"`
	Error           string                 `json:"error,omitempty"`
}

type ExecutionContext struct {
	IsCancelled func() bool
	Log         func(msg string, level string)
}

type FaultExecutor interface {
	Name() string
	DisplayName() string
	Description() string
	RequiresActiveContainer() bool
	ValidateParameters(params map[string]interface{}) (map[string]interface{}, error)
	Execute(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *ExecutionContext) (*FaultResult, error)
	Rollback(dm *docker.Manager, containerName string, params map[string]interface{}, ctx *ExecutionContext) bool
}
