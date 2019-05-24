# SLA Monitor Report SQS Worker Lambda

This service pre-generates reports based on the CloudWatch SLA Monitor custom metrics, and stores those reports on S3, so that they can be viewed in the webapp very quickly, as the rendering time is done in advance.  This is in place of a REST API, since the data can all be generated in advance.

Each time SLA results are published from the SLA Runner, there are two Lambda function which suscribe to that SNS event, sla-monitor-store-results-lambda, and this report worker lambda, which reads the values previously written to CloudWatch by the store results lambda combined with the current value from the SNS event.

## Hosting the S3 Content in a Web Server

Because the S3 bucket which these results are stored in is private, it is not accessible over the Internet.  You can use an S3 Proxy like the following to make it accessible via HTTP within a private subnet within your network.

```shell
docker build -f Dockerfile.s3proxy -t sla-monitor/sla-monitor-reports-s3proxy:latest .

iam-docker-run \
    --image sla-monitor/sla-monitor-reports-s3proxy:latest \
    -p 8080:80 \
    -e AWS_S3_BUCKET=sla-monitor-reports-dev-us-east-1 \
    --role sla-monitor-reports-s3proxy-us-east-1 \
    --profile dev
```

Once the S3 reverse proxy web server is running, you can retrieve reports via:
http://localhost:8080/dev/services.json  
http://localhost:8080/dev/myservicename/summary.json  
http://localhost:8080/dev/myservicename/history/1d.json  

Of course you will need to run the report lambda to generate and store this output on S3 to begin with, see the section below on invoking the report generator for local testing.

## Example Output

This service produces the following output.

### Example Output - Service Current Summary

`s3://<bucketname>/<env>/<servicename>/summary.json`  
`s3://sla-monitor-reports-dev-us-east-1/dev/myservice/summary.json`
```json
{
    "serviceName": "myservice",
    "env": "dev",
    "currentStatus": "SUCCESS|FAILURE",
    "rangeSummaries": [
        {
            "timeRange": "1d",
            "summary": {
                "numAttempts": 100,
                "numSuccesses": 99,
                "successPercent": 99,
                "failureMinutes": 13,
                "numFailures": 2,
                "numOutages": 1
            }
        },
        // repeast for 1d, 3d, 7d, 14d (later perhaps 30d, 60d, 90d)
    ],
    "statusChanges": [
        {
            "status": "SUCCESS|FAILURE|UNKNOWN",
            "fromTimestamp": "epoch",
            "toTimestamp": "epoch",
            "durationMins": 15
        }
    ]
}
```

### Example Output - Service History

`s3://<bucketname>/<env>/<servicename>/history/<timerange>.json`  
`s3://sla-monitor-reports-dev-us-east-1/dev/myservice/history/1d.json`
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

### Example Output - Services List

`s3://<bucketname>/<env>/services.json`  
`s3://sla-monitor-reports-dev-us-east-1/dev/services.json`
```json
[
  {
    "service": "myservice"
  },
  {
    "service": "anotherservice"
  }  
]
```

## Setup

Install dependencies for local building and deploying.

```shell
pip install iam-docker-run
```

## Testing

There must be data written to CloudWatch via the SLA Runner project before this report service will have any data to test:
https://github.com/billtrust/sla-monitor-runner

When invoking the test below, you'll need to specify the name of the service which contains the data you are testing by passing the TEST_SERVICE environment variable.  This must match up to the service name you published the data under with the SLA Monitor Runner.

```bash
docker build -t sla-monitor/sla-monitor-report-sqsworker-lambda .

export AWS_ENV="dev"
iam-docker-run \
    --image sla-monitor/sla-monitor-report-sqsworker-lambda \
    --full-entrypoint '/bin/bash ./invokeLocal.sh' \
    --container-source-path /app \
    --host-source-path . \
    --interactive \
    -e AWS_ENV=$AWS_ENV \
    -e TEST_SERVICE=myservicename \
    --profile $AWS_ENV
```

## Deployment

Note: This is dependent on the SNS Topic created in:
https://github.com/billtrust/sla-monitor-store-results-lambda

### Deploy Lambda and Serverless.yml Resources

```shell
docker build -t sla-monitor/sla-monitor-report-sqsworker-lambda .
export DEPLOY_BUCKET="company-deploy-bucket"
export AWS_ENV="dev"
iam-docker-run \
    --image sla-monitor/sla-monitor-report-sqsworker-lambda \
    --full-entrypoint "sls deploy --deployBucket $DEPLOY_BUCKET" \
    --container-source-path /app \
    --host-source-path . \
    -e AWS_ENV=$AWS_ENV \
    --profile $AWS_ENV
```

### Deploy S3 Proxy Container and Terraform Resources

This will deploy the Docker container for the S3 Proxy web server to AWS ECS via Terraform.  It assumes you have an existing ECS cluster and a VPC setup with private subnets, and that you already have a S3 bucket and DynamoDB table used for Terraform remote state.  Alternatively, if you okay with having the data in these reports accessible on the Internet, you could have made the S3 bucket public.

Terraform will prompt you to enter several values for existing resources in your infrastructure.  Rather than type these in, you will want to create a `dev.auto.tfvars` file in your terraform/dev/ directory with the values to each of the variables Terraform will prompt you for.

```shell
# pip install iam-starter
pushd terraform
# fill these exports in with your own values per environment
export PROFILE="dev"
export AWS_ENV="dev"
export REGION="us-east-1"
export AWS_BACKEND_REGION="us-east-1"
export AWS_DEFAULT_REGION="us-east-1"
export AWS_REMOTE_BUCKET="mycompany-tfstate-$AWS_ENV"
export AWS_REMOTE_TABLE="tfstate_$AWS_ENV"
iam-starter \
    --profile $PROFILE \
    --command \
        "terraform init \
        -backend-config=\"region=$AWS_BACKEND_REGION\" \
        -backend-config=\"bucket=$AWS_REMOTE_BUCKET\" \
        -backend-config=\"dynamodb_table=$AWS_REMOTE_TABLE\" && \
        terraform apply \
        -var \"aws_env=$AWS_ENV\" \
        -var \"aws_region=$AWS_DEFAULT_REGION\""

popd
docker build -f Dockerfile.s3proxy -t sla-monitor/sla-monitor-reports-s3proxy:latest .

export ACCOUNT_ID=$( \
    aws sts get-caller-identity \
    --query 'Account' \
    --output text \
    --profile $PROFILE)

# authenticate local docker client with remote ecr repository	
CMD=$(aws ecr get-login \
    --no-include-email \
    --region $REGION \
    --profile $PROFILE)	
eval $CMD
# tag the image so it can be pushed to the repository	
docker tag \
    sla-monitor/sla-monitor-reports-s3proxy:latest \
    $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/sla-monitor/sla-monitor-reports-s3proxy:latest
# push to the remote repository	
docker push \
    $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/sla-monitor/sla-monitor-reports-s3proxy:latest
```
