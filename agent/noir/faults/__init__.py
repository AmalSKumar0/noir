"""
Noir Fault Injection Engine
Safe, reversible, allowlisted chaos and reliability testing for Docker-containerized projects.
"""

from .base import FaultExecutor, FaultResult
from .registry import registry, SUPPORTED_FAULTS
from .docker import DockerManager

__all__ = [
    "FaultExecutor",
    "FaultResult",
    "registry",
    "SUPPORTED_FAULTS",
    "DockerManager",
]
