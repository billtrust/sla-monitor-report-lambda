output DNS_ZONE_ID {
    value = "${aws_route53_zone.sla_monitor.zone_id}"
}