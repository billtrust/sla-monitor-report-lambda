terraform {
  backend "s3" {
    key             = "sla-monitor-reports-s3proxy/terraform.tfstate"
  }
}
