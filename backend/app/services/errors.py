"""Shared service-level exceptions."""


class ServiceError(ValueError):
    """Base service exception."""


class NotFoundError(ServiceError):
    """Entity was not found."""


class ValidationError(ServiceError):
    """Input payload is invalid."""


class ConflictError(ServiceError):
    """Unique or business conflict."""


class DependencyError(ServiceError):
    """Action blocked by dependent entities."""
