from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, Optional


@dataclass
class FaultResult:
    success: bool
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    duration_seconds: float = 0.0
    recovered: bool = True
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "message": self.message,
            "details": self.details,
            "duration_seconds": self.duration_seconds,
            "recovered": self.recovered,
            "error": self.error,
        }


class FaultExecutor(ABC):
    """
    Abstract base class for all Noir fault injection executors.
    Every fault must define:
      - name: machine-readable key matching backend enum
      - display_name: human-readable name for Rich UI
      - description: safety summary and behavior
      - validate_parameters: strictly verifies parameters
      - execute: performs the Docker operation
      - rollback: reverts changes to restore original state
    """
    name: str = ""
    display_name: str = ""
    description: str = ""
    requires_active_container: bool = True

    @abstractmethod
    def validate_parameters(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate and normalize parameters. Raise ValueError or TypeError on invalid input.
        """
        pass

    @abstractmethod
    def execute(
        self,
        docker_mgr: Any,
        container_name: str,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> FaultResult:
        """
        Execute the fault on the specified container.
        """
        pass

    def rollback(
        self,
        docker_mgr: Any,
        container_name: str,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Revert/cleanup after fault completion or interruption.
        Returns True if container is verified healthy/recovered.
        """
        return True
