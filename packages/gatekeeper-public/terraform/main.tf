resource "docker_container" "gatekeeper-public" {
  name  = "gatekeeper-public-${var.env}"
  image = "docker-registry.kabala.tech/gtms/gatekeeperpublic:${var.tag}"
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
    value = "gatekeeper-public-${var.env}"
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
    "TAGS_SERVICE_URL=service-tags-${var.env}",
    "PORT=80"
  ]
}