
variable "project_name" {
  description = "Application name"
  type        = string
  default     = "Sri Byraweswara Traders"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "development"

  validation {
    condition = contains(
      ["development", "testing", "production"],
      var.environment
    )

    error_message = "Environment must be development, testing, or production."
  }
}

variable "replica_count" {
  description = "Number of application replicas"
  type        = number
  default     = 2

  validation {
    condition     = var.replica_count >= 1 && var.replica_count <= 5
    error_message = "Replica count must be between 1 and 5."
  }
}

variable "enable_monitoring" {
  description = "Enable monitoring"
  type        = bool
  default     = true
}

variable "application_ports" {
  description = "Application service ports"
  type        = map(number)

  default = {
    frontend = 3001
    backend  = 5001
    database = 3307
  }
}

variable "environments" {
  description = "Deployment environments"
  type        = list(string)

  default = [
    "development",
    "testing",
    "production"
  ]
}
