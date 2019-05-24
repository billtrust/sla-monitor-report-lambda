# NOTE: the task role is created in serverless.yml

resource "aws_iam_role" "reports_s3proxy_service_role" {
    name = "sla-monitor-ecs-service-reports-s3proxy-${var.aws_region}"

    assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "reports_s3proxy_service_role_attach" {
    role = "${aws_iam_role.reports_s3proxy_service_role.name}"
    policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceRole"
}
