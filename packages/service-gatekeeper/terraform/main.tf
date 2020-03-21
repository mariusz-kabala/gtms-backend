resource "docker_container" "service-gatekeeper" {
  name  = "service-gatekeeper-${var.env}"
  image = "docker-registry.kabala.tech/gtms/servicegatekeeper:${var.tag}"
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
    value = "service-gatekeeper-${var.env}"
  }

  labels {
    label = "traefik.backend"
    value = "service-gatekeeper-${var.env}"
  }

  labels {
    label = "traefik.frontend.rule"
    value = "PathPrefixStrip:/api;Host:${var.app_domain}"
  }

  labels {
    label = "traefik.protocol"
    value = "http"
  }

  labels {
    label = "traefik.port"
    value = "80"
  }

  env = [
    "RUN_ENV=${var.env}",
    "JWT_SECRET=${var.jwt_secret}",
    "VERSION=${var.tag}",
    "AUTH_SERVICE_URL=service-auth-${var.env}",
    "GROUPS_SERVICE_URL=service-groups-${var.env}",
    "PORT=80"
  ]
}
