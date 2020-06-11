resource "docker_container" "swagger" {
  name  = "swagger-${var.env}"
  image = "docker-registry.kabala.tech/gtms/swagger:${var.tag}"
  restart = "always"
  networks_advanced {
      name = "kabala-net"
  }

  labels {
    label = "traefik.enable"
    value = "true"
  }

  labels {
    label = "traefik.backend"
    value = "swagger-${var.env}"
  }

  labels {
    label = "traefik.frontend.rule"
    value = "PathPrefix:/docs;Host:${var.app_domain}"
  }

  labels {
    label = "traefik.protocol"
    value = "http"
  }

  labels {
    label = "traefik.port"
    value = "80"
  }

  dns = [
    "172.18.0.100"
  ]

  env = [
    "VERSION=${var.tag}",
    "PORT=80",
    "CONSUL_HOST=consul-client",
    "CONSUL_PORT=8500"
  ]
}
