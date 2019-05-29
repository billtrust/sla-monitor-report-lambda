resource "aws_route53_record" "reports_s3proxy" {
    zone_id = "${var.route53_zone_id}"
    name    = "${var.hostname}"
    type    = "A"

    alias {
        evaluate_target_health = true
        name = "${aws_alb.reports_s3proxy.dns_name}"
        zone_id = "${aws_alb.reports_s3proxy.zone_id}"
    }
}