resource "aws_ecr_repository" "s3proxy" {
  name = "${var.docker_container_name}"
}
