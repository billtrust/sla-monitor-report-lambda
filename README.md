# SLA Monitor Report SQS Worker Lambda

Each time SLA results are stored to the custom CloudWatch metrics, an SNS topic will fire to kick off this report renderer which will pre-render the summary and detail reports for each service for various time ranges (1d, 7d, 30d).

## Example Output

This service produces the following output.

### Example Output - Service Current Summary

s3://<bucketname>/<env>/<servicename>/current-summary.json
s3://sla-monitor-reports-dev-us-east-1/dev/myservice/current-summary.json
```json
{
    "serviceName": "myservice",
    "env": "dev",
    "currentStatus": "SUCCESS|FAILURE",
    "rangeSummaries": [
        {
            "timerange": "1d",
            "numAttempts": 100,
            "numSuccesses": 99,
            "successPercent": 99,
            "failureMinutes": 13,
            "numFailures": 2,
            "numOutages": 1
        },
        // repeast for 1d, 3d, 7d, 14d (later perhaps 30d, 60d, 90d)
    ],
    "statusChanges": [
        {
            "status": "SUCCESS|FAILURE|UNKNOWN",
            "fromTimestamp": "epoch",
            "toTimestamp": "epoch",
            "duration": "human readable like 2 days, 15 minutes, etc."
        }
    ]
}
```

### Example Output - Service History

s3://<bucketname>/<env>/<servicename>/<timerange>.json
s3://sla-monitor-reports-dev-us-east-1/dev/myservice/1d.json
```json
{
    "history": [
        {
            "timestamp": "1574533200",
            "succeeded": true,
            "testExecutionSecs": 34,
            "resultS3Location": "s3://bucket/key"
        },
        {
            "timestamp": "1574531101",
            "succeeded": true,
            "testExecutionSecs": 33,
            "resultS3Location": "s3://bucket/key"
        }
    ]
}
```

## Setup

Install dependencies for local building and deploying.

```shell
pip install iam-docker-run
```

## Testing

```bash
docker build -t sla-monitor-report-sqsworker-lambda .

export DEPLOY_BUCKET="company-deploy-bucket"
export AWS_ENV="dev"
iam-docker-run \
    --image sla-monitor-report-sqsworker-lambda \
    --full-entrypoint '/bin/bash ./invokeLocal.sh' \
    --container-source-path /app \
    --host-source-path . \
    -e AWS_ENV=$AWS_ENV \
    --interactive \
    --profile $AWS_ENV
```

## Deployment

Note: This is dependent on the SNS Topic created in:
https://github.com/billtrust/sla-monitor-store-results-lambda

```shell
docker build -t sla-monitor-report-sqsworker-lambda .
export DEPLOY_BUCKET="company-deploy-bucket"
export AWS_ENV="dev"
iam-docker-run \
    --image sla-monitor-report-sqsworker-lambda \
    --full-entrypoint "sls deploy --deployBucket $DEPLOY_BUCKET" \
    --container-source-path /app \
    --host-source-path . \
    -e AWS_ENV=$AWS_ENV \
    --profile $AWS_ENV
```
