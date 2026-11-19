resource "docker_network" "app_network" {
  name   = "sri-byraweswara-terraform-network"
  driver = "bridge"
}