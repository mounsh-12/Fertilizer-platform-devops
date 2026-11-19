
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

provider "local" {}

locals {
  project_identifier = "${var.project_name}-${var.environment}"

  project_summary = <<-EOT
    Project: ${var.project_name}
    Environment: ${var.environment}
    Replica Count: ${var.replica_count}
    Monitoring: ${var.enable_monitoring}
    Project Identifier: ${local.project_identifier}
  EOT
}

# Main project resource
resource "local_file" "project_info" {
  filename = "${path.module}/project-info.txt"
  content  = local.project_summary
}

# Demonstration of count
resource "local_file" "environment_files" {
  count = length(var.environments)

  filename = "${path.module}/${var.environments[count.index]}.txt"

  content = <<-EOT
    Project: ${var.project_name}
    Environment: ${var.environments[count.index]}
  EOT

  depends_on = [
    local_file.project_info
  ]
}

# Demonstration of for_each
resource "local_file" "service_files" {
  for_each = var.application_ports

  filename = "${path.module}/${each.key}-service.txt"

  content = <<-EOT
    Project: ${var.project_name}
    Service: ${each.key}
    Port: ${each.value}
  EOT
}

# Demonstration of implicit dependency
resource "local_file" "deployment_summary" {
  filename = "${path.module}/deployment-summary.txt"

  content = <<-EOT
    Project information file: ${local_file.project_info.filename}
    Deployment environment: ${var.environment}
    Project identifier: ${local.project_identifier}
  EOT
}
