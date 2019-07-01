resource "aws_route53_record" "reports_s3proxy" {
    zone_id = "${aws_route53_zone.sla_monitor.id}" #"${var.route53_zone_id}"
    name    = "${var.hostname}"
    type    = "A"

    alias {
        evaluate_target_health = true
        name = "${aws_alb.reports_s3proxy.dns_name}"
        zone_id = "${aws_alb.reports_s3proxy.zone_id}"
    }
}

# create internal DNS zone
resource "aws_route53_zone" "sla_monitor" {
    name = "${var.dnsname}."
    vpc {
        vpc_id  = "${var.vpc_id}"
        vpc_region = "${var.aws_region}"
    }
}
