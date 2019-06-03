variable "application" {
    default = "sla-monitor-reports-s3proxy"
}

variable "docker_container_name" {
    default = "sla-monitor/sla-monitor-reports-s3proxy"
}

variable "aws_region" {
    default="us-east-1"
}

variable "aws_env" {}

variable "vpc_id" {}

variable "ecs_cluster" {}

variable "alb_subnet1" {}

variable "alb_subnet2" {}

variable "alb_security_group_id" {}

variable "alb_port" {
    default="80"
}

variable "hostname" {}

variable "dnsname" {
    description = "The dnsname where the web portions will be hosted at, e.g. slamon.yourcompany.com, slamon-dev.yourcompany.com"
}
