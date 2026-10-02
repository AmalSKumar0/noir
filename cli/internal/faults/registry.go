package faults

import (
	"noir-cli/internal/faults/executors"
)

type Registry struct {
	executors map[string]FaultExecutor
}

var DefaultRegistry *Registry

func init() {
	DefaultRegistry = NewRegistry()
}

func NewRegistry() *Registry {
	r := &Registry{
		executors: make(map[string]FaultExecutor),
	}
	r.Register(&executors.ContainerRestartExecutor{})
	r.Register(&executors.ContainerStopExecutor{})
	r.Register(&executors.NetworkDelayExecutor{})
	r.Register(&executors.NetworkLossExecutor{})
	r.Register(&executors.CpuStressExecutor{})
	r.Register(&executors.MemoryStressExecutor{})
	return r
}

func (r *Registry) Register(e FaultExecutor) {
	r.executors[e.Name()] = e
}

func (r *Registry) Get(name string) FaultExecutor {
	return r.executors[name]
}

func (r *Registry) IsSupported(name string) bool {
	_, ok := r.executors[name]
	return ok
}

func (r *Registry) ListAll() []FaultExecutor {
	var list []FaultExecutor
	// ordered list for consistent display
	names := []string{
		"container_restart",
		"container_stop",
		"network_delay",
		"network_loss",
		"cpu_stress",
		"memory_stress",
	}
	for _, n := range names {
		if e, ok := r.executors[n]; ok {
			list = append(list, e)
		}
	}
	return list
}

func (r *Registry) SupportedNames() []string {
	var names []string
	for _, e := range r.ListAll() {
		names = append(names, e.Name())
	}
	return names
}
