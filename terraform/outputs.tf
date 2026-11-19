
output "project_identifier" {
  value = local.project_identifier
}

output "environment_files" {
  value = local_file.environment_files[*].filename
}

output "service_files" {
  value = {
    for service, resource in local_file.service_files :
    service => resource.filename
  }
}

output "deployment_summary" {
  value = local_file.deployment_summary.filename
}
