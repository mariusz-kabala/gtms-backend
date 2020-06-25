resource "docker_container" "service-tags" {
  name  = "service-tags-${var.env}"
  image = "docker-registry.kabala.tech/gtms/servicetags:${var.tag}"
  restart = "always"
  networks_advanced {
      name = "kabala-net"
  }

  labels {
    label = "traefik.enable"
    value = "false"
  }

  env = [
    "QUEUE_HOST=${var.queue_host}",
    "DB_HOST=mongo-${var.env}-db",
    "DB_NAME=${var.db_name}",
    "VERSION=${var.tag}",
    "PORT=80",
    "INTERNAL_GATEKEEPER=http://service-gatekeeper-internal-${var.env}/v1",
    "CONSUL_HOST=consul-client",
    "CONSUL_PORT=8500"
  ]
}
