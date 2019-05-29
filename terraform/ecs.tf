resource "aws_ecs_service" "reports_s3proxy" {
  name                               = "sla-monitor-reports-s3proxy"
  cluster                            = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster/${var.ecs_cluster}"
  desired_count                      = "1"
  iam_role                           = "${aws_iam_role.reports_s3proxy_service_role.arn}"
  deployment_minimum_healthy_percent = "50"
  deployment_maximum_percent         = "200"
  health_check_grace_period_seconds  = "30"

  task_definition = "${aws_ecs_task_definition.reports_s3proxy.arn}"

  load_balancer {
    target_group_arn = "${aws_alb_target_group.reports_s3proxy.arn}"
    container_name   = "${lower(replace(var.application, " ", ""))}"
    container_port   = 80
  }

  ordered_placement_strategy {
    type  = "spread"
    field = "instanceId"
  }

  ordered_placement_strategy {
    type  = "spread"
    field = "attribute:ecs.availability-zone"
  }
}

resource "aws_ecs_task_definition" "reports_s3proxy" {
  family        = "${lower(replace(var.application, " ", ""))}"
  # iam role created by serverless.yml
  task_role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/sla-monitor-reports-s3proxy-${var.aws_region}"

  container_definitions = <<DEFINITION
[
  {
    "volumesFrom": [],
    "extraHosts": null,
    "dnsServers": null,
    "disableNetworking": null,
    "dnsSearchDomains": null,
    "portMappings": [
      {
        "hostPort": 0,
        "containerPort": 80,
        "protocol": "tcp"
      }
    ],
    "hostname": null,
    "essential": true,
    "entryPoint": null,
    "mountPoints": [],
    "name": "${lower(replace(var.application, " ", ""))}",
    "ulimits": null,
    "dockerSecurityOptions": null,
    "environment": [
      {
        "name": "AWS_REGION",
        "value": "${var.aws_region}"
      },
      {
          "name": "AWS_S3_BUCKET",
          "value": "sla-monitor-reports-dev-${var.aws_region}"
      },
      {
        "name": "HEALTHCHECK_PATH",
        "value": "/health"
      },
      {
        "name": "CORS_ALLOW_ORIGIN",
        "value": "*"
      },
      {
        "name": "CORS_ALLOW_METHODS",
        "value": "GET"
      },
      {
        "name": "CORS_ALLOW_HEADERS",
        "value": "*"
      }
    ],
    "links": null,
    "workingDirectory": null,
    "readonlyRootFilesystem": null,
    "image": "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.docker_container_name}:latest",
    "command": null,
    "user": null,
    "dockerLabels": null,
    "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
            "awslogs-group": "${aws_cloudwatch_log_group.reports_s3proxy.name}",
            "awslogs-region": "${var.aws_region}",
            "awslogs-stream-prefix": "${aws_cloudwatch_log_stream.reports_s3proxy.name}"
        }
    },
    "cpu": 0,
    "privileged": null,
    "memoryReservation": 500,
    "memory": 1000
  }
]
DEFINITION
}

resource "aws_cloudwatch_log_group" "reports_s3proxy" {
  name = "sla-monitor-reports-s3proxy"
}

resource "aws_cloudwatch_log_stream" "reports_s3proxy" {
  name           = "ecs-container"
  log_group_name = "${aws_cloudwatch_log_group.reports_s3proxy.name}"
}
