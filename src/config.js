const config = {
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    REPORTS_SQS_QUEUE_NAME: process.env.REPORTS_SQS_QUEUE_NAME,
    METRIC_NAMESPACE: process.env.METRIC_NAMESPACE,
    REPORTS_S3_BUCKET_NAME: process.env.REPORTS_S3_BUCKET_NAME,
    REPORTS_S3_PREFIX: process.env.REPORTS_S3_PREFIX,
    TIME_RANGES: process.env.TIME_RANGES,
    SLARUNNER_S3BUCKETNAME: process.env.SLARUNNER_S3BUCKETNAME,
    SERVICES_LIST_TTL_SECONDS: process.env.SERVICES_LIST_TTL_SECONDS
  }
  
module.exports = config
