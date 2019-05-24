resource "aws_alb" "reports_s3proxy" {
  name            = "${lower(var.application)}-alb"
  internal        = true
  security_groups = ["${var.alb_security_group_id}"]

  subnets = [
    "${var.alb_subnet1}",
    "${var.alb_subnet2}",
  ]

  idle_timeout = 60
}

resource "aws_alb_target_group" "reports_s3proxy" {
  name                 = "${var.application}"
  port                 = "${var.alb_port}"
  protocol             = "HTTP"
  vpc_id               = "${var.vpc_id}"
  deregistration_delay = 10

  health_check {
    path                = "/health"
    interval            = 15
    timeout             = 14
    healthy_threshold   = 2
    unhealthy_threshold = 2
    protocol            = "HTTP"
  }
}

resource "aws_alb_listener" "reports_s3proxy_http" {
  load_balancer_arn = "${aws_alb.reports_s3proxy.arn}"
  port              = "80"
  protocol          = "HTTP"

  default_action {
    target_group_arn = "${aws_alb_target_group.reports_s3proxy.arn}"
    type             = "forward"
  }

  lifecycle = {
    create_before_destroy = true
  }
}

resource "aws_alb_listener_rule" "http_s3proxy" {
  listener_arn = "${aws_alb_listener.reports_s3proxy_http.arn}"
  priority     = "100"

  action {
    type             = "forward"
    target_group_arn = "${aws_alb_target_group.reports_s3proxy.arn}"
  }

  condition {
    field  = "host-header"
    values = ["${var.hostname}"]
  }
}
