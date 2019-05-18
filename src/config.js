const config = {
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    REPORTS_SQS_QUEUE_NAME: process.env.REPORTS_SQS_QUEUE_NAME,
    METRIC_NAMESPACE: process.env.METRIC_NAMESPACE,
    METRIC_RESOLUTION: process.env.METRIC_RESOLUTION,
    REPORTS_S3_BUCKET_NAME: process.env.REPORTS_S3_BUCKET_NAME
  }
  
module.exports = config
