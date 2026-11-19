output "project_name" {
  value = var.project_name
}

output "terraform_network_name" {
  value = docker_network.app_network.name
}