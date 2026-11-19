
project_name      = "Sri Byraweswara Traders"
environment       = "development"
replica_count     = 2
enable_monitoring = true

environments = [
  "development",
  "testing",
  "production"
]

application_ports = {
  frontend = 3001
  backend  = 5001
  database = 3307
}
