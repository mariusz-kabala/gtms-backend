resource "docker_container" "worker-files" {
  name  = "worker-files-${var.env}"
  image = "${var.DOCKER_REGISTRY}/gtms/workerfiles:${var.tag}"
  restart = "always"
  networks_advanced {
      name = "kabala-net"
  }

  labels {
    label = "traefik.enable"
    value = "false"
  }

  labels {
    label = "gtms"
    value = "qa-master"
  }

  env = [
    "QUEUE_HOST=${var.queue_host}",
    "DB_HOST=mongo-${var.env}-db",
    "DB_NAME=${var.db_name}",
    "VERSION=${var.tag}",
    "PORT=80",
    "BUCKET_GROUP_LOGO=${var.BUCKET_GROUP_LOGO}",
    "BUCKET_GROUP_BG=${var.BUCKET_GROUP_BG}",
    "BUCKET_GROUP_COVER=${var.BUCKET_GROUP_COVER}",
    "BUCKET_AVATAR=${var.BUCKET_AVATAR}",
    "BUCKET_USER_GALLERY=${var.BUCKET_USER_GALLERY}",
    "BUCKET_GROUP_TAG_LOGO=${var.BUCKET_GROUP_TAG_LOGO}",
    "BUCKET_POST_IMAGE=${var.BUCKET_POST_IMAGE}",
    "AWS_ACCESS_KEY_ID=${var.AWS_ACCESS_KEY_ID}",
    "AWS_SECRET_ACCESS_KEY=${var.AWS_SECRET_ACCESS_KEY}",
    "AWS_REGION=${var.AWS_REGION}",
    "AWS_ENDPOINT=${var.AWS_ENDPOINT}",
    "CONSUL_HOST=consul-client",
    "CONSUL_PORT=8500"
  ]
}
