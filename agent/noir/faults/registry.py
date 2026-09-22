from typing import Dict, List, Optional, Type
from .base import FaultExecutor
from .executors import (
    ContainerRestartExecutor,
    ContainerStopExecutor,
    NetworkDelayExecutor,
    NetworkLossExecutor,
    CpuStressExecutor,
    MemoryStressExecutor,
)


class FaultRegistry:
    """
    Registry for all supported Noir fault executors.
    Guarantees strict allowlisting of permissible operations.
    """

    def __init__(self):
        self._executors: Dict[str, FaultExecutor] = {}
        self._register_defaults()

    def register(self, executor: FaultExecutor) -> None:
        self._executors[executor.name] = executor

    def _register_defaults(self) -> None:
        self.register(ContainerRestartExecutor())
        self.register(ContainerStopExecutor())
        self.register(NetworkDelayExecutor())
        self.register(NetworkLossExecutor())
        self.register(CpuStressExecutor())
        self.register(MemoryStressExecutor())

    def get(self, name: str) -> Optional[FaultExecutor]:
        return self._executors.get(name)

    def is_supported(self, name: str) -> bool:
        return name in self._executors

    def list_all(self) -> List[FaultExecutor]:
        return list(self._executors.values())

    def supported_names(self) -> List[str]:
        return list(self._executors.keys())


# Global default registry instance
registry = FaultRegistry()
SUPPORTED_FAULTS = registry.supported_names()
